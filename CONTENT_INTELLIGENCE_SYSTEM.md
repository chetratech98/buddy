# Content Intelligence System - Implementation Guide

## Overview
Enhanced AI blog generation system that leverages comprehensive SERP analysis to create ranking-optimized content.

## Architecture

### Flow
```
User Input (Keyword/Topic)
    ↓
SERP Analysis (if not exists)
    ↓
Content Intelligence Layer
    ├─ Search Intent Detection
    ├─ Keyword Clustering
    ├─ Outline Generation
    ├─ Competitor Analysis
    ├─ FAQ Extraction
    ├─ Schema Generation
    └─ Semantic Entities
    ↓
Enhanced Blog Generation
    ├─ Intent-Optimized Structure
    ├─ Competitor-Informed Content
    ├─ FAQ Section
    ├─ Schema Markup
    └─ Entity Coverage
    ↓
Content Output + Metrics
```

## Phase 1 Implementation ✅

### 1. Content Intelligence Edge Function
**File**: `supabase/functions/content-intelligence/index.ts`

**Features**:
- Fetches existing SERP analysis data
- Extracts keyword-specific insights
- Generates intelligent outlines based on:
  - Search intent (informational/commercial/transactional/navigational)
  - Competitor patterns
  - Common topics
  - Content benchmarks
- Provides FAQ suggestions from People Also Ask
- Generates schema markup templates
- Extracts semantic entities

**API**:
```typescript
POST /content-intelligence
{
  "keyword": "best project management software",
  "userId": "user-id",
  "serpAnalysisId": "optional-id",
  "includeOutline": true,
  "includeHeadings": true,
  "includeFAQ": true
}

Response: ContentIntelligence object with all insights
```

### 2. Enhanced Generate-Blog Integration
**Next Steps**:

1. **Modify generate-blog to call content-intelligence first**:
   ```typescript
   // Before generating content, get intelligence
   const intelligenceRes = await supabase.functions.invoke("content-intelligence", {
     body: { keyword: primaryKeyword, userId: user.id }
   });
   const intelligence = intelligenceRes.data;
   ```

2. **Use intelligence in prompt**:
   - Target word count from benchmarks
   - Outline structure from analysis
   - FAQ questions from PAA
   - Semantic entities to include
   - Content gaps to address

3. **Enhanced prompt template**:
   ```
   SEARCH INTENT: ${intelligence.searchIntent.primary}
   TARGET WORD COUNT: ${intelligence.optimization.targetWordCount}
   TONE: ${intelligence.optimization.toneAndStyle}
   
   REQUIRED STRUCTURE (follow this outline):
   ${intelligence.outline.sections.map(s => `${s.heading} (${s.estimatedWords} words)`).join('\n')}
   
   MUST INCLUDE THESE ENTITIES:
   ${intelligence.semanticEntities.required.join(', ')}
   
   FAQ SECTION (required):
   ${intelligence.faq.map(f => f.question).join('\n')}
   
   CONTENT GAPS TO ADDRESS:
   ${intelligence.contentGaps.join('\n')}
   ```

## Phase 2 - Advanced Features

### 1. Competitor Heading Extraction
**Enhancement**: Extract actual H2/H3 structure from scraped competitor content

```typescript
function extractHeadings(markdown: string) {
  const h2s = markdown.match(/^## (.+)$/gm) || [];
  const h3s = markdown.match(/^### (.+)$/gm) || [];
  return {
    h2: h2s.map(h => h.replace('## ', '')),
    h3: h3s.map(h => h.replace('### ', ''))
  };
}
```

### 2. Enhanced FAQ Generation
- Extract from People Also Ask SERP feature
- Extract from competitor FAQ sections
- Generate AI answers based on top content

### 3. Schema Generation
- Article schema
- FAQPage schema
- HowTo schema (for guides)
- Product schema (for reviews)

### 4. Semantic Entity Extraction
- NLP analysis of top 3 competitors
- Extract named entities, key phrases
- Build must-include entity list

## Phase 3 - Optimization Features

### 1. AI Overview Optimization
- Analyze AI Overview snippets
- Optimize for featured snippet formats
- Structure content for AI summarization

### 2. Enhanced NLP Scoring
- Readability (Flesch-Kincaid)
- Sentiment analysis
- Entity coverage
- Topic relevance score

### 3. Topical Authority Maps
- Track content clusters
- Identify coverage gaps
- Suggest internal linking opportunities

### 4. Internal Linking AI
- Analyze existing content
- Suggest relevant internal links
- Build topic clusters

### 5. Content Decay Detection
- Monitor rankings over time
- Detect freshness issues
- Trigger refresh recommendations

## Data Flow

### SERP Analysis Output (Existing)
```json
{
  "keywords": [{
    "keyword": "keyword",
    "searchIntent": "informational",
    "intentConfidence": 85,
    "difficulty": "medium",
    "difficultyScore": 45,
    "targetWordCount": 1800,
    "recommendedContentFormat": "guide",
    "topCompetitors": [...],
    "relatedKeywords": [...],
    "serpFeatures": ["PAA", "Related Searches"],
    "contentBenchmark": {
      "avgWordCount": 1800,
      "avgH2Count": 8,
      "structuralPatterns": [...]
    },
    "quickWins": [...],
    "opportunity": "..."
  }],
  "overallInsights": {
    "commonTopics": [...],
    "recommendations": [...]
  }
}
```

### Content Intelligence Output (New)
```json
{
  "keyword": "keyword",
  "searchIntent": { "primary": "informational", "confidence": 85 },
  "contentBenchmark": { "avgWordCount": 1800, "dominantContentType": "guide" },
  "outline": {
    "sections": [
      {
        "heading": "Introduction",
        "level": 2,
        "subtopics": [...],
        "estimatedWords": 200,
        "priority": "must-have"
      }
    ]
  },
  "competitors": [...],
  "faq": [...],
  "schema": [...],
  "semanticEntities": {
    "required": [...],
    "recommended": [...]
  },
  "contentGaps": [...],
  "optimization": {
    "targetWordCount": 1800,
    "recommendedH2Count": 9,
    "toneAndStyle": "informative and educational"
  }
}
```

## Implementation Priority

### Immediate (This Session)
✅ 1. Created content-intelligence edge function
⏳ 2. Integrate with generate-blog
⏳ 3. Test with existing SERP data

### Short-term (Next)
- Enhance UI to show intelligence insights before generation
- Add outline preview/editor
- Display entity checklist during writing

### Medium-term
- Implement Phase 2 features (heading extraction, schema)
- Add content scoring dashboard
- Build topical authority tracker

### Long-term
- Implement Phase 3 features (AI Overview optimization, decay detection)
- Build automated content refresh system
- Create internal linking AI

## Success Metrics

### Content Quality
- Higher average word count (target: 1800+)
- Better structure (proper H2/H3 hierarchy)
- FAQ sections in 100% of posts
- Entity coverage >90%

### SEO Performance
- Improved average position
- Featured snippet capture rate
- AI Overview inclusion rate
- Click-through rate improvement

### User Experience
- Faster content generation
- More consistent quality
- Better outline structure
- Actionable insights before writing
