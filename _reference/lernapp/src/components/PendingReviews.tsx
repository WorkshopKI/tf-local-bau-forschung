import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_COLORS } from "@/lib/constants";

const mockReviews = [
  { title: "SEO Content Prompt", author: "Anna B.", submitted: "vor 1 Tag", priority: "hoch", department: "Marketing" },
  { title: "Data Cleaning Template", author: "Jan M.", submitted: "vor 2 Tagen", priority: "mittel", department: "Engineering" },
  { title: "Kundenfeedback Analyse", author: "Lisa R.", submitted: "vor 3 Tagen", priority: "niedrig", department: "Support" },
];

export const PendingReviews = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{mockReviews.length} ausstehende Reviews</h3>

      <div className="space-y-2">
        {mockReviews.map((review) => (
          <Card key={review.title} className="p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{review.title}</span>
                  <Badge className={`text-[10px] ${PRIORITY_COLORS[review.priority] || ""}`}>
                    {review.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>von {review.author}</span>
                  <span>{review.department}</span>
                  <span>{review.submitted}</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/library")}>
                Review
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
