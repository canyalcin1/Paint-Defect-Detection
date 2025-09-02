const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const http = require("http");
const express = require("express");
const serveStatic = require("serve-static");

let mainWindow;
let pythonProcess;
let staticServer; // Express server ref

const isDev = !app.isPackaged;
const FRONT_PORT = process.env.PORT || 3000;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
else app.on("second-instance", () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

function getBackendRoot() {
  return isDev ? path.join(__dirname, "..", "backend")
               : path.join(process.resourcesPath, "backend");
}

function resolvePythonExe(backendRoot) {
  // 1) Venv (sen şu an bunu paketliyorsun)
  const venvPy = process.platform === "win32"
    ? path.join(backendRoot, "venv-backend", "Scripts", "python.exe")
    : path.join(backendRoot, "venv-backend", "bin", "python");
  if (fs.existsSync(venvPy)) return venvPy;

  // 2) (Opsiyonel) gömülü Python varsa:
  const embedded = process.platform === "win32"
    ? path.join(backendRoot, "python", "python.exe")
    : path.join(backendRoot, "python", "bin", "python3");
  if (fs.existsSync(embedded)) return embedded;

  // 3) Sistem Python (son çare)
  return "python";
}

function getPythonPaths() {
  const backendRoot = getBackendRoot();
  const pythonExe = resolvePythonExe(backendRoot);
  const backendMain = path.join(backendRoot, "main.py");
  return { backendRoot, pythonExe, backendMain };
}

function getFreePort(prefer = 8000) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => {
      const s2 = net.createServer();
      s2.listen(0, "127.0.0.1", () => {
        const p = s2.address().port;
        s2.close(() => resolve(p));
      });
    });
    s.listen(prefer, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function waitHttpOk(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function ping() {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) resolve();
        else if (Date.now() - start > timeoutMs) reject(new Error("Not ready: " + res.statusCode));
        else setTimeout(ping, 300);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error("Not ready: connection error"));
        else setTimeout(ping, 300);
      });
    })();
  });
}

async function startPythonBackend(port, frontOriginForCors = "*") {
  const { backendRoot, pythonExe, backendMain } = getPythonPaths();

  const env = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    CLIENT_ORIGIN: frontOriginForCors // FastAPI CORS bunu okuyor
  };

  await new Promise((resolve, reject) => {
    pythonProcess = spawn(
      pythonExe,
      ["-u", backendMain, "--host", "127.0.0.1", "--port", String(port)],
      { cwd: backendRoot, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    pythonProcess.stdout.on("data", d => console.log("[PY]", d.toString().trim()));
    pythonProcess.stderr.on("data", d => console.error("[PY:ERR]", d.toString().trim()));
    pythonProcess.on("exit", c => console.log("Python exited", c));

    waitHttpOk(`http://127.0.0.1:${port}/health`, 20000).then(resolve).catch(reject);
  });
  console.log(`Backend ready: http://127.0.0.1:${port}/health`);
  return port;
}

async function startStaticFrontServer() {
  // resources/app altındaki out/ export’u servis et
  const appRoot = isDev
    ? path.join(__dirname, "..", "out")
    : path.join(process.resourcesPath, "app");

  if (!fs.existsSync(path.join(appRoot, "index.html"))) {
    throw new Error("Static frontend not found (index.html yok): " + appRoot);
  }

  const port = await getFreePort(5173);
  const appSrv = express();

  // out/ içeriğini kökten yayınla
  appSrv.use(serveStatic(appRoot, { index: ["index.html"] }));
  // SPA fallback
  appSrv.get("*", (_req, res) => res.sendFile(path.join(appRoot, "index.html")));

  await new Promise((resolve) => {
    staticServer = appSrv.listen(port, "127.0.0.1", () => resolve());
  });

  const url = `http://127.0.0.1:${port}`;
  console.log("Front server at", url);
  return url;
}

async function createMainWindow(frontUrl) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  await mainWindow.loadURL(frontUrl);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    let frontUrl;

    if (isDev) {
      // Dev: Next dev (3000) + backend
      frontUrl = `http://localhost:${FRONT_PORT}`;
      const backendPort = await getFreePort(8000);
      await startPythonBackend(backendPort, frontUrl);
      await createMainWindow(frontUrl);
      return;
    }

    // Prod: önce statik front server'ı başlat (out/ → http://127.0.0.1:<port>)
    frontUrl = await startStaticFrontServer();

    // Sonra backend'i başlat (CORS frontUrl'e açık)
    const backendPort = await getFreePort(8000);
    await startPythonBackend(backendPort, frontUrl);

    await createMainWindow(frontUrl);

  } catch (e) {
    console.error(e);
    dialog.showErrorBox("Startup Error", String(e?.message || e));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  if (pythonProcess && !pythonProcess.killed) pythonProcess.kill();
  if (staticServer) {
    try { staticServer.close(); } catch {}
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // tekrar açılırsa front server'ı yeniden kurmak gerekir — basitçe app'ı kapatıyoruz
  }
});
