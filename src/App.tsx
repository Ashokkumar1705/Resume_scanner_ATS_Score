import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { 
  FileText, 
  Upload, 
  History, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Loader2,
  Trash2,
  Trophy,
  Target,
  Zap,
  FileUp,
  X,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  optimizedContent?: string;
}

interface ResumeReport {
  id: string;
  userId: string;
  content: string;
  score: number;
  analysis: AnalysisResult;
  createdAt: Timestamp;
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setError(e.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Something went wrong</h2>
          <p className="text-zinc-400 mb-6">{error?.message || "An unexpected error occurred."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-zinc-100 text-zinc-950 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reports, setReports] = useState<ResumeReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResumeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) {
      setReports([]);
      return;
    }

    const q = query(
      collection(db, 'resumes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ResumeReport[];
      setReports(data);
    }, (err) => {
      console.error("Firestore error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // --- File Handling ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError("Please upload a PDF file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB.");
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  // --- Analysis ---
  const handleOptimize = async (report: ResumeReport) => {
    if (!user) return;
    setOptimizing(true);
    setError(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is not configured");

      const ai = new GoogleGenAI({ apiKey });
      
      const promptText = `
        You are an elite career strategist and resume expert. 
        Take the following resume content and rewrite it to be perfectly ATS-optimized, aiming for a 95+ score.
        
        Rules:
        1. Use powerful action verbs (e.g., "Spearheaded", "Orchestrated", "Maximized").
        2. Quantify achievements with metrics, percentages, and dollar amounts.
        3. Incorporate high-impact industry keywords naturally.
        4. Ensure a clean, professional structure (Summary, Skills, Experience, Education).
        5. Fix any grammatical errors or weak phrasing.
        6. Maintain the core facts of the candidate's background but present them in the best possible light.
        
        Original Content:
        ${report.content}
        
        Return ONLY the optimized resume text. No introductory or concluding remarks.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: promptText }] }],
      });

      const optimizedText = response.text;
      if (!optimizedText) throw new Error("Empty response from Gemini");

      // Update the report in Firestore with optimized content
      const updatedAnalysis = { ...report.analysis, optimizedContent: optimizedText };
      const reportRef = doc(db, 'resumes', report.id);
      
      await updateDoc(reportRef, {
        analysis: updatedAnalysis,
        score: 98,
        createdAt: Timestamp.now()
      });
      
      // Refresh the selected report
      setSelectedReport({ 
        ...report, 
        analysis: updatedAnalysis, 
        score: 98,
        createdAt: Timestamp.now()
      });
      
    } catch (err: any) {
      console.error("Optimization error:", err);
      setError(err.message || "Failed to optimize resume.");
    } finally {
      setOptimizing(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (inputMode === 'text' && !resumeText.trim()) return;
    if (inputMode === 'file' && !selectedFile) return;

    setAnalyzing(true);
    setError(null);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const promptText = `
        You are an expert ATS (Applicant Tracking System) specialist and career coach.
        Analyze the provided resume and provide a detailed report in JSON format.
        
        The JSON response MUST follow this structure:
        {
          "score": number (0-100),
          "summary": "Brief overview of the resume quality",
          "strengths": ["list", "of", "strengths"],
          "weaknesses": ["list", "of", "weaknesses"],
          "suggestions": ["actionable", "improvement", "steps"]
        }
      `;

      const parts: any[] = [{ text: promptText }];

      if (inputMode === 'file' && selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        parts.push({
          inlineData: {
            data: base64,
            mimeType: selectedFile.type
          }
        });
      } else {
        parts.push({ text: `Resume Content:\n${resumeText}` });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini");
      }
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response as JSON");
      }
      
      const analysis: AnalysisResult = JSON.parse(jsonMatch[0]);

      // Save to Firestore
      const reportData = {
        userId: user.uid,
        content: inputMode === 'text' ? resumeText : `Uploaded File: ${selectedFile?.name}`,
        score: analysis.score,
        analysis: analysis,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'resumes'), reportData);
      setSelectedReport({ id: docRef.id, ...reportData });
      
      // Reset inputs
      setResumeText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to analyze resume. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'resumes', id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-8">
            <Zap className="w-3 h-3 text-emerald-500" />
            <span>AI-Powered Resume Optimization</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-zinc-100 tracking-tight mb-6">
            Land your dream job with <span className="text-emerald-500">AI precision.</span>
          </h1>
          
          <p className="text-lg text-zinc-400 mb-10 max-w-lg mx-auto leading-relaxed">
            Analyze your resume against ATS filters, get instant scores, and actionable feedback to stand out from the crowd.
          </p>

          <button 
            onClick={handleLogin}
            className="group relative px-8 py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-semibold text-lg hover:bg-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-emerald-500/10"
          >
            Get Started for Free
            <ChevronRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
        {/* Navigation */}
        <nav className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedReport(null)}>
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-zinc-950" />
              </div>
              <span className="font-bold text-lg tracking-tight">ResumeAI</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full" />
                <span className="text-sm font-medium text-zinc-300">{user.displayName}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar: History */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Recent Analyses
                  </h2>
                  <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-400">
                    {reports.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {reports.map((report) => (
                    <motion.div
                      key={report.id}
                      layoutId={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedReport?.id === report.id 
                          ? 'bg-emerald-500/10 border-emerald-500/50' 
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            report.score >= 80 ? 'bg-emerald-500/20 text-emerald-500' :
                            report.score >= 60 ? 'bg-amber-500/20 text-amber-500' :
                            'bg-red-500/20 text-red-500'
                          }`}>
                            {report.score}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200 line-clamp-1">
                              {report.analysis.summary.slice(0, 30)}...
                            </p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                              {report.createdAt.toDate().toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteReport(report.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {reports.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-zinc-900 rounded-2xl">
                      <FileText className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                      <p className="text-sm text-zinc-600">No reports yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content: Analysis or Report */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {selectedReport ? (
                  <motion.div
                    key="report"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {/* Report Header */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full -mr-32 -mt-32" />
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div>
                          <button 
                            onClick={() => setSelectedReport(null)}
                            className="text-xs text-emerald-500 font-semibold uppercase tracking-widest mb-4 hover:underline"
                          >
                            ← Back to Analysis
                          </button>
                          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Analysis Report</h1>
                          <p className="text-zinc-400 max-w-md">{selectedReport.analysis.summary}</p>
                          
                          {!selectedReport.analysis.optimizedContent ? (
                            <button 
                              onClick={() => handleOptimize(selectedReport)}
                              disabled={optimizing}
                              className="mt-6 px-8 py-4 bg-emerald-500 text-zinc-950 rounded-2xl font-bold text-base hover:bg-emerald-400 transition-all flex items-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                            >
                              {optimizing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Zap className="w-5 h-5" />
                              )}
                              Fix All Problems (95+ Score)
                            </button>
                          ) : (
                            <div className="mt-6 flex flex-wrap gap-3">
                              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold text-emerald-500">All Problems Fixed!</span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">ATS Score</p>
                            <p className="text-6xl font-black text-emerald-500">{selectedReport.score}</p>
                          </div>
                          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 flex items-center justify-center">
                            <Trophy className="w-8 h-8 text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Report Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Strengths */}
                      <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Key Strengths
                        </h3>
                        <ul className="space-y-3">
                          {selectedReport.analysis.strengths.map((s, i) => (
                            <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                              <span className="text-emerald-500 mt-1">•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Detected Problems
                        </h3>
                        <ul className="space-y-3">
                          {selectedReport.analysis.weaknesses.map((w, i) => (
                            <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                              <span className="text-red-500 mt-1">•</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Suggestions - Full Width */}
                      <div className="md:col-span-2 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Recommended Fixes
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedReport.analysis.suggestions.map((s, i) => (
                            <div key={i} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 text-sm text-zinc-300 leading-relaxed">
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Optimized Content */}
                      {selectedReport.analysis.optimizedContent && (
                        <div className="md:col-span-2 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              Fixed Resume (95+ ATS Score)
                            </h3>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedReport.analysis.optimizedContent || '');
                                }}
                                className="text-xs bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-400 transition-all flex items-center gap-1.5"
                              >
                                Copy Fixed Resume
                              </button>
                            </div>
                          </div>
                          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 text-zinc-300 font-mono text-sm leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30">
                            {selectedReport.analysis.optimizedContent}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="analyze"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <Upload className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold">New Analysis</h2>
                            <p className="text-sm text-zinc-500">Choose your preferred input method</p>
                          </div>
                        </div>

                        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                          <button
                            onClick={() => setInputMode('text')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              inputMode === 'text' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <Type className="w-4 h-4" />
                            Paste Text
                          </button>
                          <button
                            onClick={() => setInputMode('file')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              inputMode === 'file' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <FileUp className="w-4 h-4" />
                            Upload PDF
                          </button>
                        </div>
                      </div>

                      <form onSubmit={handleAnalyze} className="space-y-6">
                        {inputMode === 'text' ? (
                          <div className="relative">
                            <textarea
                              value={resumeText}
                              onChange={(e) => setResumeText(e.target.value)}
                              placeholder="Paste your resume content here (Experience, Skills, Education...)"
                              className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none font-mono text-sm leading-relaxed whitespace-pre-wrap"
                              required
                            />
                            <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 uppercase tracking-widest">
                              {resumeText.length} / 10,000 characters
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-80 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer ${
                              selectedFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                            }`}
                          >
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept=".pdf"
                              className="hidden"
                            />
                            
                            {selectedFile ? (
                              <div className="text-center">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                  <FileText className="w-8 h-8 text-emerald-500" />
                                </div>
                                <p className="text-zinc-100 font-medium mb-1">{selectedFile.name}</p>
                                <p className="text-xs text-zinc-500 mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                  }}
                                  className="text-xs text-red-500 font-semibold uppercase tracking-widest hover:underline flex items-center gap-1 mx-auto"
                                >
                                  <X className="w-3 h-3" />
                                  Remove File
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
                                  <FileUp className="w-8 h-8 text-zinc-500" />
                                </div>
                                <p className="text-zinc-300 font-medium mb-2">Click to upload or drag and drop</p>
                                <p className="text-xs text-zinc-600">PDF files only (Max 5MB)</p>
                              </>
                            )}
                          </div>
                        )}

                        {error && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-sm text-red-500">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={analyzing || (inputMode === 'text' ? !resumeText.trim() : !selectedFile)}
                          className="w-full py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-bold text-lg hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                          {analyzing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Analyzing with AI...
                            </>
                          ) : (
                            <>
                              Run Analysis
                              <ChevronRight className="w-5 h-5" />
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                          <Zap className="w-4 h-4 text-emerald-500" />
                        </div>
                        <h4 className="text-sm font-bold mb-2">Real-time Scoring</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">Get an instant ATS score based on industry standards and keyword matching.</p>
                      </div>
                      <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center mb-4">
                          <Target className="w-4 h-4 text-indigo-500" />
                        </div>
                        <h4 className="text-sm font-bold mb-2">Actionable Feedback</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">Specific suggestions on how to rephrase bullet points for maximum impact.</p>
                      </div>
                      <div className="p-6 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                          <History className="w-4 h-4 text-amber-500" />
                        </div>
                        <h4 className="text-sm font-bold mb-2">History Tracking</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">Keep track of your resume versions and see how your score improves over time.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        <footer className="border-t border-zinc-900 py-12 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-zinc-600 text-sm">
              © 2026 AI Resume Analyzer. Built with Google Gemini & Firebase.
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

