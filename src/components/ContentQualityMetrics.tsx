import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, XCircle, FileText, HelpCircle, Target } from "lucide-react";

interface ContentQualityMetricsProps {
  wordCount: number;
  targetWordCount?: number;
  hasFAQ?: boolean;
  keywords?: string[];
}

export const ContentQualityMetrics = ({
  wordCount,
  targetWordCount = 1500,
  hasFAQ = false,
  keywords = [],
}: ContentQualityMetricsProps) => {
  // Calculate word count status
  const wordCountPercentage = (wordCount / targetWordCount) * 100;
  const wordCountStatus = 
    wordCount >= targetWordCount * 0.9 && wordCount <= targetWordCount * 1.1 ? 'excellent' :
    wordCount >= targetWordCount * 0.7 ? 'good' : 'needs-improvement';

  // Calculate overall quality score
  const qualityScore = Math.round(
    (Math.min(wordCountPercentage, 100) * 0.5) + // 50% weight on word count
    (hasFAQ ? 30 : 0) + // 30 points for FAQ
    (keywords.length > 0 ? 20 : 0) // 20 points for keywords
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'good':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-yellow-500';
      default:
        return 'text-red-500';
    }
  };

  const getBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Content Quality
          </CardTitle>
          <Badge variant={getBadgeVariant(qualityScore)} className="text-sm px-3">
            {qualityScore}% Score
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Word Count Metric */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(wordCountStatus)}
              <span className="font-medium">Word Count</span>
            </div>
            <span className={getStatusColor(wordCountStatus)}>
              {wordCount} / {targetWordCount}
            </span>
          </div>
          <Progress value={Math.min(wordCountPercentage, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {wordCountStatus === 'excellent' && '✓ Perfect! Meets target word count'}
            {wordCountStatus === 'good' && '⚠ Close to target - consider adding more content'}
            {wordCountStatus === 'needs-improvement' && '✗ Below target - add more sections and examples'}
          </p>
        </div>

        {/* FAQ Section Metric */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="font-medium">FAQ Section</span>
            </div>
            <span className={hasFAQ ? 'text-green-500' : 'text-red-500'}>
              {hasFAQ ? 'Included' : 'Missing'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasFAQ 
              ? '✓ FAQ section helps with "People Also Ask" SERP features'
              : '✗ Add a FAQ section to improve SEO and answer common questions'}
          </p>
        </div>

        {/* Keywords Metric */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="font-medium">Keywords</span>
            </div>
            <span className={keywords.length > 0 ? 'text-green-500' : 'text-red-500'}>
              {keywords.length} keywords
            </span>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {keywords.slice(0, 5).map((keyword, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {keywords.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{keywords.length - 5} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quality Recommendations */}
        {qualityScore < 80 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium mb-2">Recommendations:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {wordCountStatus !== 'excellent' && (
                <li>• {wordCount < targetWordCount ? 'Add more sections and examples' : 'Content may be too long - consider breaking into multiple posts'}</li>
              )}
              {!hasFAQ && <li>• Add a FAQ section with 3-5 common questions</li>}
              {keywords.length === 0 && <li>• Include target keywords for better SEO</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
