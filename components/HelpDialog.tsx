"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type HelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-gray-900/80 dark:bg-white/10
          backdrop-blur-md
          rounded-lg
          shadow-xl
          border border-gray-700/40 dark:border-white/20
          p-6
          max-w-3xl
          mx-auto
          transform
          transition-all
          duration-300
          hover:scale-105
          text-white dark:text-black
          overflow-y-auto max-h-[80vh]
        "
      >
        <DialogHeader>
          <DialogTitle>Boya Kusurları Analiz Sistemi – Yardım</DialogTitle>
          <DialogDescription>
            Bu kılavuz; fotoğraf yükleme, analiz etme, sonuçları görüntüleme,
            yüklemeleri ve geçmiş klasörlerini yönetme adımlarını açıklar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 text-sm md:text-base">
          <section>
            <h3 className="font-semibold">1. Fotoğraf Yükleme</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Analiz edilecek fotoğrafları sürükleyip bırakın veya seçin.
                Desteklenen formatlar: <strong>TIFF, JPG, PNG, BMP</strong>.
              </li>
              <li>
                <strong>Klasör adı (Grup)</strong> girmeniz gerekir. Sonuçlar bu
                klasör altında saklanır.
              </li>
              <li>
                <strong>Tespit Başlat</strong> butonuna basarak seçili model ile
                analizi başlatın.
              </li>
              <li>
                <strong>Eminlik yüzdesi: </strong>
                Yapılacak olan tahminin en az yüzde kac eminlikle yapılacağı.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">2. Analiz Sonuçları</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                İşlenmiş fotoğraflarda bulunan kusurlar kutucuk ve etiketlerle
                gösterilir.
              </li>
              <li>
                Özet panelinde toplam görsel, toplam tespit ve kusur tiplerine
                göre dağılım yer alır.
              </li>
              <li>
                Sonuçları ZIP olarak indirebilirsiniz. ZIP dosyası hem raporları
                (Excel + JSON) hem de işlenmiş görselleri içerir.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">3. Yüklemeler Yönetimi</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Sol alttaki <strong>Yüklenenler</strong> butonuna tıklayarak
                mevcut yüklenen dosyaları görebilirsiniz.
              </li>
              <li>
                Dosyaları işaretleyip şu işlemleri yapabilirsiniz:
                <ul className="list-disc ml-6 space-y-1">
                  <li>
                    <strong>Seçiliyi Sil</strong>: seçili dosyaları
                    yüklemelerden kaldırır.
                  </li>
                  <li>
                    <strong>ZIP İndir</strong>: seçili dosyaları tek bir ZIP
                    arşivi halinde indirir.
                  </li>
                </ul>
              </li>
              <li>
                Tek tek dosyaları da <em>“Yeni sekmede aç” </em> bağlantısı ile
                görüntüleyebilirsiniz.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">4. Geçmiş Yönetimi</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Daha önce yapılmış analizler <strong>Geçmiş Tespitler </strong>
                bölümünde listelenir.
              </li>
              <li>
                Arama kutusu ile grup adı veya run ID’ye göre filtreleme
                yapabilirsiniz.{" "}
                <em>
                  Run ID: YIL+AY+GUN_SAAT+DAKIKA+SANIYE (ör: 20250904_135752)
                </em>
              </li>
              <li>
                Geçmiş klasörler için yapılabilecek işlemler:
                <ul className="list-disc ml-6 space-y-1">
                  <li>Görüntüle: Seçili çalışmaya ait görselleri açar.</li>
                  <li>ZIP indir: Çalışmayı topluca indirmenizi sağlar.</li>
                  <li>
                    Yeniden adlandırma: Grup veya run klasör adını
                    değiştirebilirsiniz.
                  </li>
                  <li>Sil: Seçili çalışmayı tamamen kaldırır.</li>
                </ul>
              </li>
              <li>
                Birden fazla geçmiş klasörünü seçip topluca silebilirsiniz.
              </li>
            </ul>
          </section>

          <p>
            Bu sistem, fotoğraflarınızı kolayca yüklemenizi, analiz etmenizi ve
            kusur tespitlerini düzenli şekilde arşivlemenizi sağlar.
          </p>
        </div>

        <DialogFooter className="mt-4 flex justify-between">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
