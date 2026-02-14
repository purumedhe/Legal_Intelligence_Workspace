import { FileText, Gavel, Shield, BookOpen, Scale } from "lucide-react";

interface AnalysisData {
  legalSections: { section: string; description: string }[];
  punishmentRange: string;
  presentationStrategy: string;
  casePrecedents: { name: string; relevance: string }[];
  courtDocument: string;
}

interface AnalysisResultsProps {
  data: AnalysisData;
  onViewDocument: () => void;
}

const AnalysisResults = ({ data, onViewDocument }: AnalysisResultsProps) => {
  const cards = [
    {
      number: 1,
      title: "Applicable Legal Sections",
      icon: Scale,
      content: (
        <ul className="space-y-1.5 text-sm text-secondary-foreground">
          {data.legalSections.map((s, i) => (
            <li key={i}>• {s.section} – {s.description}</li>
          ))}
        </ul>
      ),
    },
    {
      number: 2,
      title: "Punishment / Sentence Range",
      icon: Gavel,
      content: <p className="text-sm text-secondary-foreground">{data.punishmentRange}</p>,
    },
    {
      number: 3,
      title: "Court Presentation Strategy",
      icon: Shield,
      content: <p className="text-sm text-secondary-foreground">{data.presentationStrategy}</p>,
    },
    {
      number: 4,
      title: "Relevant Case Precedents",
      icon: BookOpen,
      content: (
        <ul className="space-y-1.5 text-sm text-secondary-foreground">
          {data.casePrecedents.map((c, i) => (
            <li key={i}>• {c.name} – {c.relevance}</li>
          ))}
        </ul>
      ),
    },
    {
      number: 5,
      title: "Court-Ready Documentation",
      icon: FileText,
      content: (
        <div>
          <p className="text-sm text-secondary-foreground mb-3">
            Auto-generated brief with headings, facts, legal grounds, and prayer clause (PDF export ready).
          </p>
          <button
            onClick={onViewDocument}
            className="text-sm font-medium text-primary hover:text-gold-bright underline underline-offset-2 transition-colors"
          >
            View Full Document →
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.number}
          className="rounded-xl border border-border bg-card p-5 card-hover"
        >
          <div className="flex items-center gap-2 mb-3">
            <card.icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-primary">
              {card.number}. {card.title}
            </h3>
          </div>
          {card.content}
        </div>
      ))}
    </div>
  );
};

export default AnalysisResults;
export type { AnalysisData };
