import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, RotateCcw, Loader2 } from "lucide-react";

const CASE_CATEGORIES = [
  "Criminal", "Civil", "Constitutional", "Family", "Cyber Crime",
  "Property", "Labour", "Consumer", "Environmental", "Corporate",
];

const OFFENCE_TYPES = [
  "Murder / Homicide", "Theft / Robbery", "Fraud / Cheating", "Assault / Battery",
  "Kidnapping / Abduction", "Sexual Offence", "Drug Offence", "Corruption",
  "Defamation", "Breach of Trust", "Domestic Violence", "Dowry Related",
];

interface CaseNotepadProps {
  onAnalyze: (description: string, category: string, offence: string) => void;
  isLoading: boolean;
}

const CaseNotepad = ({ onAnalyze, isLoading }: CaseNotepadProps) => {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [offence, setOffence] = useState("");

  const handleAnalyze = () => {
    if (!description.trim()) return;
    onAnalyze(description, category, offence);
  };

  const handleReset = () => {
    setDescription("");
    setCategory("");
    setOffence("");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-xl font-serif font-bold text-foreground">Case Notepad</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe the case briefly (max two sentences). Select filters to narrow legal accuracy.
        </p>
      </div>

      <Textarea
        placeholder="Example: A person intentionally caused the death of another individual due to personal enmity."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[120px] bg-input border-border text-foreground placeholder:text-muted-foreground resize-none focus:ring-1 focus:ring-primary"
      />

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px] bg-input border-border text-foreground">
            <SelectValue placeholder="Case Category" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {CASE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={offence} onValueChange={setOffence}>
          <SelectTrigger className="w-[200px] bg-input border-border text-foreground">
            <SelectValue placeholder="Offence Type" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {OFFENCE_TYPES.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleAnalyze}
          disabled={!description.trim() || isLoading}
          className="bg-primary text-primary-foreground hover:bg-gold-bright font-semibold px-6"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scale className="w-4 h-4 mr-2" />}
          Analyze Case
        </Button>
      </div>

      <Button
        variant="outline"
        onClick={handleReset}
        className="border-border text-muted-foreground hover:text-foreground hover:border-primary"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset
      </Button>
    </section>
  );
};

export default CaseNotepad;
