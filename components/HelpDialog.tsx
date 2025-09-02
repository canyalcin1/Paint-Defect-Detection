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
          <DialogTitle>Book Catalog System – Help</DialogTitle>
          <DialogDescription>
            This guide will help you with key features: creating, importing,
            exporting, searching, and managing book information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 text-sm md:text-base">
          <section>
            <h3 className="font-semibold">File Operations</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Create:</strong> Click "Create" in the File menu. Enter
                ISBN, title, author, tags, and other details. ISBN is mandatory.
                Cover images can be uploaded via file path.
              </li>
              <li>
                <strong>Import:</strong> Select JSON files via the Import option
                to load book data.
              </li>
              <li>
                <strong>Export:</strong> Save the current book database to a
                JSON file using the Export option.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Searching and Filtering</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Basic Search:</strong> Search by keywords (ISBN, author,
                title, publisher). Results update in the list view.
              </li>
              <li>
                <strong>Tag Filtering:</strong> Use the dropdown to select one
                or more tags. Click "Filter" to show books matching all selected
                tags.
              </li>
              <li>
                <strong>Combined Search and Filter:</strong> Enter a keyword and
                select tags, then click "Search and Filter" to refine results.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Book Details and Management</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Show Details:</strong> Select a book and click "Show
                Details" to view all information.
              </li>
              <li>
                <strong>Edit:</strong> Select a book and click "Edit" to modify
                its details.
              </li>
              <li>
                <strong>Delete:</strong> Select a book, click "Delete", and
                confirm to remove it.
              </li>
            </ul>
          </section>

          <p>
            This documentation provides clear guidance for managing your book
            collection effectively. Follow these instructions to create, edit,
            search, and organize your books efficiently.
          </p>
        </div>

        <DialogFooter className="mt-4 flex justify-between">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
