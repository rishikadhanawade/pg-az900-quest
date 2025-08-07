import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Award, BookOpen, BarChart3, Play, RotateCcw, Moon, Sun } from "lucide-react";

// Types --------------------------------------------------------------------
export interface QuestionRow {
  set_id: string;
  question_id: string;
  domain: string;
  objective: string;
  difficulty: "easy" | "medium" | "hard";
  type: "single" | "multi";
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  option_f: string;
  correct: string;
  explanation: string;
  image_url: string;
  tags: string;
}

interface QuizHistory {
  q: QuestionRow;
  sel: string[];
  ok: boolean;
}

// Utilities ----------------------------------------------------------------
const csvUrl = "/data/questions.csv";

const parseCsv = async (): Promise<QuestionRow[]> => {
  const resp = await fetch(csvUrl);
  const txt = await resp.text();
  const parsed = Papa.parse<QuestionRow>(txt, { header: true, skipEmptyLines: true });
  return parsed.data.filter(row => row.question); // Filter out empty rows
};

const percent = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "easy": return "bg-success text-success-foreground";
    case "medium": return "bg-warning text-warning-foreground";
    case "hard": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

// Main App ------------------------------------------------------------------
export default function QuizApp() {
  const [allQs, setAll] = useState<QuestionRow[]>([]);
  const [filtered, setFiltered] = useState<QuestionRow[]>([]);
  const [setId, setSetId] = useState<string>("");
  const [domain, setDomain] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [currentIdx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSel] = useState<string[]>([]);
  const [history, setHist] = useState<QuizHistory[]>([]);
  const [mode, setMode] = useState<"home" | "quiz" | "review" | "results" | "coverage">("home");
  const [showAnswer, setShowAnswer] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Load CSV once
  useEffect(() => {
    parseCsv().then(setAll);
  }, []);

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Derive options
  const setOptions = useMemo(() => Array.from(new Set(allQs.map(q => q.set_id))).sort(), [allQs]);
  const domainOptions = useMemo(() => Array.from(new Set(allQs.map(q => q.domain))).sort(), [allQs]);
  const difficultyOptions = ["easy", "medium", "hard"];

  // Apply filters
  useEffect(() => {
    const out = allQs.filter(
      q => (!setId || q.set_id === setId) && (!domain || q.domain === domain) && (!diff || q.difficulty === diff)
    );
    setFiltered(out);
  }, [allQs, setId, domain, diff]);

  const current = filtered[currentIdx];
  const progress = filtered.length > 0 ? ((currentIdx + 1) / filtered.length) * 100 : 0;

  // Handlers ----------------------------------------------------------------
  const startQuiz = () => {
    if (!filtered.length) return alert("No questions match filters");
    setIdx(0);
    setScore(0);
    setSel([]);
    setHist([]);
    setShowAnswer(false);
    setMode("quiz");
  };

  const submitAnswer = () => {
    if (!current || selected.length === 0) return;
    
    const corr = current.correct.split(";");
    const ok = selected.length === corr.length && selected.every(s => corr.includes(s));
    setScore(prev => prev + (ok ? 1 : 0));
    setHist(h => [...h, { q: current, sel: [...selected], ok }]);
    setShowAnswer(true);
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= filtered.length) {
      setMode("results");
    } else {
      setIdx(i => i + 1);
      setSel([]);
      setShowAnswer(false);
    }
  };

  const resetQuiz = () => {
    setMode("home");
    setIdx(0);
    setScore(0);
    setSel([]);
    setHist([]);
    setShowAnswer(false);
  };

  // Coverage calculations ---------------------------------------------------
  const coverage = useMemo(() => {
    const byDom = allQs.reduce<Record<string, number>>((m, q) => {
      m[q.domain] = (m[q.domain] || 0) + 1;
      return m;
    }, {});
    const byDiff = allQs.reduce<Record<string, number>>((m, q) => {
      m[q.difficulty] = (m[q.difficulty] || 0) + 1;
      return m;
    }, {});
    const total = allQs.length;
    return { total, byDom, byDiff };
  }, [allQs]);

  // UI Components -----------------------------------------------------------
  const OptionRow = ({ keyLetter, text }: { keyLetter: string; text: string }) => {
    if (!text) return null;
    
    const isSelected = selected.includes(keyLetter);
    const isCorrect = current?.correct.split(";").includes(keyLetter);
    
    let className = "quiz-option cursor-pointer";
    if (showAnswer) {
      if (isCorrect) className += " correct";
      else if (isSelected && !isCorrect) className += " incorrect";
    } else if (isSelected) {
      className += " selected";
    }

    return (
      <div 
        className={className}
        onClick={() => {
          if (showAnswer) return;
          const k = keyLetter;
          setSel(sel => (current?.type === "multi" 
            ? (sel.includes(k) ? sel.filter(i => i !== k) : [...sel, k]) 
            : [k]));
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
            {keyLetter}
          </div>
          <span className="flex-1">{text}</span>
          {showAnswer && isCorrect && <CheckCircle className="w-5 h-5 text-success" />}
          {showAnswer && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive" />}
        </div>
      </div>
    );
  };

  // Render Components -------------------------------------------------------
  const renderHome = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Dedication Card */}
      <Card className="gradient-card shadow-azure">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Azure AZ-900 Quiz Platform
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">
            Dear <span className="font-semibold text-primary">Pooja (PG)</span>, here's your interactive practice platform to help you ace the <span className="font-semibold text-accent">AZ-900</span> certification.
          </p>
          <p className="text-sm text-muted-foreground">
            Wishing you focused preparation and a smooth exam day. — <em className="text-accent">Rishika</em>
          </p>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold text-primary">{allQs.length}</div>
            <div className="text-sm text-muted-foreground">Total Questions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold text-accent">{Object.keys(coverage.byDom).length}</div>
            <div className="text-sm text-muted-foreground">Knowledge Domains</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-success" />
            <div className="text-2xl font-bold text-success">{setOptions.length}</div>
            <div className="text-sm text-muted-foreground">Question Sets</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Quiz Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question Set</label>
              <Select value={setId} onValueChange={setSetId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sets</SelectItem>
                  {setOptions.map(set => (
                    <SelectItem key={set} value={set}>{set}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Domain</label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="All Domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Domains</SelectItem>
                  {domainOptions.map(dom => (
                    <SelectItem key={dom} value={dom}>{dom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={diff} onValueChange={setDiff}>
                <SelectTrigger>
                  <SelectValue placeholder="All Difficulties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Difficulties</SelectItem>
                  {difficultyOptions.map(difficulty => (
                    <SelectItem key={difficulty} value={difficulty}>
                      <span className="capitalize">{difficulty}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {filtered.length} question{filtered.length !== 1 ? 's' : ''} selected
            </div>
            <Button onClick={startQuiz} disabled={!filtered.length} className="gradient-azure">
              <Play className="w-4 h-4 mr-2" />
              Start Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderQuiz = () => {
    if (!current) return <div>No questions available</div>;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                Question {currentIdx + 1} of {filtered.length}
              </span>
              <span className="text-sm font-medium">
                Score: {score}/{history.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Question */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Badge variant="outline">{current.domain}</Badge>
                <Badge className={getDifficultyColor(current.difficulty)}>
                  {current.difficulty}
                </Badge>
                {current.type === "multi" && (
                  <Badge variant="secondary">Multiple Selection</Badge>
                )}
              </div>
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <h2 className="text-xl font-medium leading-relaxed">{current.question}</h2>
            
            <div className="space-y-3">
              <OptionRow keyLetter="A" text={current.option_a} />
              <OptionRow keyLetter="B" text={current.option_b} />
              <OptionRow keyLetter="C" text={current.option_c} />
              <OptionRow keyLetter="D" text={current.option_d} />
              {current.option_e && <OptionRow keyLetter="E" text={current.option_e} />}
              {current.option_f && <OptionRow keyLetter="F" text={current.option_f} />}
            </div>

            {showAnswer && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">Explanation:</h3>
                  <p className="text-sm text-muted-foreground">{current.explanation}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetQuiz}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              
              {!showAnswer ? (
                <Button onClick={submitAnswer} disabled={selected.length === 0}>
                  Submit Answer
                </Button>
              ) : (
                <Button onClick={nextQuestion}>
                  {currentIdx + 1 >= filtered.length ? "View Results" : "Next Question"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderResults = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="gradient-card shadow-azure">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Quiz Results</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-4xl font-bold text-primary">
            {percent(score, filtered.length)}%
          </div>
          <div className="text-lg text-muted-foreground">
            {score} out of {filtered.length} questions correct
          </div>
          <div className="flex justify-center gap-4 pt-4">
            <Button onClick={resetQuiz}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Take Another Quiz
            </Button>
            <Button variant="outline" onClick={() => setMode("review")}>
              <BookOpen className="w-4 h-4 mr-2" />
              Review Answers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
            <div className="text-2xl font-bold text-success">{score}</div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{filtered.length - score}</div>
            <div className="text-sm text-muted-foreground">Incorrect</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-accent" />
            <div className="text-2xl font-bold text-accent">{percent(score, filtered.length)}%</div>
            <div className="text-sm text-muted-foreground">Score</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Answers</CardTitle>
        </CardHeader>
      </Card>

      {history.map((item, idx) => (
        <Card key={idx} className={item.ok ? "border-success/50" : "border-destructive/50"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-x-2">
                <Badge variant="outline">{item.q.domain}</Badge>
                <Badge className={getDifficultyColor(item.q.difficulty)}>
                  {item.q.difficulty}
                </Badge>
              </div>
              {item.ok ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <h3 className="font-medium">{item.q.question}</h3>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Your answer:</span> {item.sel.join(", ")}
              </div>
              <div className="text-sm">
                <span className="font-medium">Correct answer:</span> {item.q.correct}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Explanation:</span> {item.q.explanation}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-center">
        <Button onClick={resetQuiz}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Take Another Quiz
        </Button>
      </div>
    </div>
  );

  const renderCoverage = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Question Coverage Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Domain Coverage */}
            <div>
              <h3 className="font-medium mb-4">By Domain</h3>
              <div className="space-y-3">
                {Object.entries(coverage.byDom).map(([domain, count]) => (
                  <div key={domain} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{domain}</span>
                      <span>{count} questions</span>
                    </div>
                    <Progress value={(count / coverage.total) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty Coverage */}
            <div>
              <h3 className="font-medium mb-4">By Difficulty</h3>
              <div className="space-y-3">
                {Object.entries(coverage.byDiff).map(([difficulty, count]) => (
                  <div key={difficulty} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{difficulty}</span>
                      <span>{count} questions</span>
                    </div>
                    <Progress value={(count / coverage.total) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Main Render -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AZ-900 Quiz Platform
              </h1>
              {mode !== "home" && (
                <Badge variant="outline">
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              
              {mode !== "home" && (
                <Button variant="outline" size="sm" onClick={resetQuiz}>
                  Home
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {mode === "home" && (
          <Tabs defaultValue="home" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="home">Quiz Setup</TabsTrigger>
              <TabsTrigger value="coverage">Coverage Analysis</TabsTrigger>
            </TabsList>
            <TabsContent value="home">{renderHome()}</TabsContent>
            <TabsContent value="coverage">{renderCoverage()}</TabsContent>
          </Tabs>
        )}
        {mode === "quiz" && renderQuiz()}
        {mode === "results" && renderResults()}
        {mode === "review" && renderReview()}
      </main>
    </div>
  );
}