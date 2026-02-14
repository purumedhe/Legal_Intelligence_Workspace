import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DocumentModalProps {
  open: boolean;
  onClose: () => void;
  document: string;
}

const DocumentModal = ({ open, onClose, document }: DocumentModalProps) => {
  const handleExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Court-Ready Document</title>
      <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8;color:#1a1a1a}h1,h2,h3{margin-top:24px}h1{text-align:center;border-bottom:2px solid #333;padding-bottom:10px}</style>
      </head><body>${document.replace(/\n/g, "<br/>")}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-card border-border text-foreground overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="font-serif text-xl text-primary">Court-Ready Document</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExport} className="bg-primary text-primary-foreground hover:bg-gold-bright">
              <Download className="w-4 h-4 mr-1" /> Export / Print
            </Button>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-2">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{document}</ReactMarkdown>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentModal;
