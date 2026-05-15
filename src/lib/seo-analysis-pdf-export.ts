import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface KeywordAnalysis {
  keyword: string;
  searchIntent?: string;
  intentConfidence?: number;
  mentionCount: number;
  difficulty: "low" | "medium" | "high";
  difficultyScore?: number;
  serpFeatures?: string[];
  targetWordCount?: number;
  recommendedContentFormat?: string;
  opportunity: string;
  topCompetitors: Array<{
    rank: number;
    title: string;
    source: string;
    url?: string;
    keywordDensity: string;
    contentType: string;
    wordCount?: number;
    contentScore?: number;
  }>;
  relatedKeywords: string[];
  contentBenchmark?: {
    avgWordCount: number;
    avgH2Count: number;
    avgImageCount: number;
    avgReadingTime: number;
    commonFormats: string[];
    structuralPatterns: string[];
  };
  quickWins?: string[];
}

interface Recommendation {
  priority?: string;
  action?: string;
  impact?: string;
  effort?: string;
}

interface AnalysisResult {
  keywords: KeywordAnalysis[];
  overallInsights: {
    dominantContentType: string;
    dominantSearchIntent?: string;
    avgWordCount: string;
    avgContentScore?: number;
    contentGaps?: string[];
    commonTopics: string[];
    serpFeatureSummary?: Record<string, number>;
    topAuthorityDomains?: string[];
    recommendations?: (Recommendation | string)[];
    contentStrategy?: {
      pillarContent: string;
      supportingContent: string[];
      contentCalendarSuggestion: string;
    };
  };
}

export function exportToPDF(result: AnalysisResult, niche: string): void {
  if (!result || !result.keywords.length) {
    console.error("No data to export");
    return;
  }

  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Helper function to check if we need a new page
  const checkAddPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(24);
  doc.setTextColor(99, 102, 241); // Primary color
  doc.text('SERP Analysis Report', margin, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Niche: ${niche}`, margin, yPos);
  yPos += 6;
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 6;
  doc.text(`Keywords Analyzed: ${result.keywords.length}`, margin, yPos);
  yPos += 15;

  // Overall Insights Section
  checkAddPage(40);
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Overall Insights', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  
  const insights = result.overallInsights;
  doc.text(`Dominant Content Type: ${insights.dominantContentType}`, margin + 5, yPos);
  yPos += 6;
  if (insights.dominantSearchIntent) {
    doc.text(`Dominant Search Intent: ${insights.dominantSearchIntent}`, margin + 5, yPos);
    yPos += 6;
  }
  doc.text(`Average Word Count: ${insights.avgWordCount}`, margin + 5, yPos);
  yPos += 6;
  if (insights.avgContentScore) {
    doc.text(`Average Content Score: ${insights.avgContentScore}`, margin + 5, yPos);
    yPos += 6;
  }
  yPos += 5;

  // Common Topics
  if (insights.commonTopics && insights.commonTopics.length > 0) {
    checkAddPage(30);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Common Topics:', margin + 5, yPos);
    yPos += 6;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    insights.commonTopics.slice(0, 10).forEach((topic) => {
      if (checkAddPage(6)) doc.setFontSize(10);
      doc.text(`• ${topic}`, margin + 10, yPos);
      yPos += 5;
    });
    yPos += 5;
  }

  // Keywords Analysis
  result.keywords.forEach((keyword, index) => {
    checkAddPage(60);
    
    // Keyword Header
    doc.setFillColor(240, 240, 245);
    doc.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(99, 102, 241);
    doc.text(`${index + 1}. ${keyword.keyword}`, margin + 3, yPos);
    yPos += 12;

    // Keyword Details
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    const details = [
      `Difficulty: ${keyword.difficulty.toUpperCase()} (${keyword.difficultyScore || 'N/A'})`,
      `Search Intent: ${keyword.searchIntent || 'N/A'}${keyword.intentConfidence ? ` (${keyword.intentConfidence}% confidence)` : ''}`,
      `Target Word Count: ${keyword.targetWordCount || keyword.contentBenchmark?.avgWordCount || 'N/A'}`,
      `Recommended Format: ${keyword.recommendedContentFormat || 'N/A'}`,
    ];

    details.forEach((detail) => {
      if (checkAddPage(6)) doc.setFontSize(10);
      doc.text(detail, margin + 5, yPos);
      yPos += 5;
    });
    yPos += 3;

    // Opportunity
    if (keyword.opportunity) {
      checkAddPage(15);
      doc.setFontSize(10);
      doc.setTextColor(0, 100, 0);
      doc.text('Opportunity:', margin + 5, yPos);
      yPos += 5;
      
      doc.setTextColor(60, 60, 60);
      const opportunityLines = doc.splitTextToSize(keyword.opportunity, pageWidth - 2 * margin - 10);
      opportunityLines.forEach((line: string) => {
        if (checkAddPage(5)) doc.setFontSize(10);
        doc.text(line, margin + 10, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Quick Wins
    if (keyword.quickWins && keyword.quickWins.length > 0) {
      checkAddPage(20);
      doc.setFontSize(10);
      doc.setTextColor(255, 140, 0);
      doc.text('Quick Wins:', margin + 5, yPos);
      yPos += 5;
      
      doc.setTextColor(60, 60, 60);
      keyword.quickWins.forEach((win) => {
        if (checkAddPage(5)) doc.setFontSize(10);
        doc.text(`• ${win}`, margin + 10, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // SERP Features
    if (keyword.serpFeatures && keyword.serpFeatures.length > 0) {
      checkAddPage(10);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`SERP Features: ${keyword.serpFeatures.join(', ')}`, margin + 5, yPos);
      yPos += 8;
    }

    // Top Competitors Table
    if (keyword.topCompetitors && keyword.topCompetitors.length > 0) {
      checkAddPage(40);
      
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Top Competitors:', margin + 5, yPos);
      yPos += 5;

      const tableData = keyword.topCompetitors.map(comp => [
        comp.rank.toString(),
        comp.title.substring(0, 40) + (comp.title.length > 40 ? '...' : ''),
        comp.source,
        comp.wordCount?.toLocaleString() || '—',
        comp.contentScore?.toString() || '—',
        comp.contentType,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Title', 'Source', 'Words', 'Score', 'Type']],
        body: tableData,
        margin: { left: margin + 5, right: margin },
        styles: { 
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [99, 102, 241],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [245, 245, 250],
        },
      });

      // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Related Keywords
    if (keyword.relatedKeywords && keyword.relatedKeywords.length > 0) {
      checkAddPage(15);
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Related Keywords:', margin + 5, yPos);
      yPos += 5;
      
      doc.setTextColor(60, 60, 60);
      const relatedText = keyword.relatedKeywords.slice(0, 10).join(', ');
      const relatedLines = doc.splitTextToSize(relatedText, pageWidth - 2 * margin - 10);
      relatedLines.forEach((line: string) => {
        if (checkAddPage(5)) doc.setFontSize(10);
        doc.text(line, margin + 10, yPos);
        yPos += 5;
      });
    }

    yPos += 10;
  });

  // Recommendations Section
  if (insights.recommendations && insights.recommendations.length > 0) {
    doc.addPage();
    yPos = margin;
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Recommendations', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    insights.recommendations.forEach((rec, index) => {
      if (checkAddPage(20)) doc.setFontSize(10);
      
      if (typeof rec === 'string') {
        const recLines = doc.splitTextToSize(`${index + 1}. ${rec}`, pageWidth - 2 * margin - 5);
        recLines.forEach((line: string) => {
          if (checkAddPage(5)) doc.setFontSize(10);
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
      } else if (rec.action) {
        doc.setTextColor(0, 0, 0);
        doc.text(`${index + 1}. ${rec.action}`, margin + 5, yPos);
        yPos += 5;
        
        doc.setTextColor(60, 60, 60);
        if (rec.priority) {
          doc.text(`   Priority: ${rec.priority}`, margin + 5, yPos);
          yPos += 5;
        }
        if (rec.impact) {
          doc.text(`   Impact: ${rec.impact}`, margin + 5, yPos);
          yPos += 5;
        }
        if (rec.effort) {
          doc.text(`   Effort: ${rec.effort}`, margin + 5, yPos);
          yPos += 5;
        }
      }
      yPos += 3;
    });
  }

  // Save the PDF
  const filename = `SERP-Analysis-${niche.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
