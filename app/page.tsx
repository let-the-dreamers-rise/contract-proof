"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileCode, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [isAnimating, setIsAnimating] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ContractProof
              </h1>
              <p className="text-xs text-muted-foreground">Bob-Powered API Drift Guard</p>
            </div>
          </div>
          <Link
            href="/demo"
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            Try Demo
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-block px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-medium mb-4">
            🚀 Built with IBM Bob for the IBM Bob Hackathon
          </div>
          
          <h2 className="text-5xl md:text-6xl font-bold leading-tight">
            Stop Shipping{" "}
            <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              Broken APIs
            </span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Detect API contract drift across your backend, frontend, documentation, and tests
            before it reaches production. Powered by IBM Bob's full repository understanding.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link
              href="/demo"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Load Sample Repo
            </Link>
            <a
              href="#problem"
              className="px-8 py-4 border-2 border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>


      {/* Problem Visualization */}
      <section id="problem" className="container mx-auto px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            The Problem: API Drift Causes 40% of Production Incidents
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Before - Broken */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-red-200 dark:border-red-900">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <h4 className="text-xl font-bold text-red-600">Without ContractProof</h4>
              </div>
              
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-mono text-sm text-red-800 dark:text-red-200">
                    <span className="text-red-600">// Backend</span><br />
                    app.get('/api/v2/users/:userId', ...)
                  </p>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-mono text-sm text-red-800 dark:text-red-200">
                    <span className="text-red-600">// Frontend (outdated)</span><br />
                    fetch('/api/users/' + id)
                  </p>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="font-mono text-sm text-red-800 dark:text-red-200">
                    <span className="text-red-600">// Docs (outdated)</span><br />
                    GET /api/users/:id
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-red-600 font-semibold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Result: 404 errors in production</span>
                </div>
              </div>
            </div>

            {/* After - Fixed */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h4 className="text-xl font-bold text-green-600">With ContractProof</h4>
              </div>
              
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="font-mono text-sm text-green-800 dark:text-green-200">
                    <span className="text-green-600">✓ Backend detected</span><br />
                    app.get('/api/v2/users/:userId', ...)
                  </p>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border-2 border-yellow-400">
                  <p className="font-mono text-sm text-yellow-800 dark:text-yellow-200">
                    <span className="text-yellow-600">⚠ Drift detected</span><br />
                    fetch('/api/users/' + id)
                  </p>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="font-mono text-sm text-blue-800 dark:text-blue-200">
                    <span className="text-blue-600">💡 Suggested fix</span><br />
                    fetch('/api/v2/users/' + userId)
                  </p>
                </div>
                
                <div className="flex items-center gap-2 text-green-600 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Result: Bug caught before deployment</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20 bg-white/50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            How ContractProof Works
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto">
                <FileCode className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-xl font-bold">Multi-Language Analysis</h4>
              <p className="text-muted-foreground">
                Detects API routes in Express, FastAPI, Flask, Next.js. Finds calls in React, fetch, axios, React Query.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-xl font-bold">Smart Drift Detection</h4>
              <p className="text-muted-foreground">
                Cross-references backend, frontend, docs, and tests. Detects path changes, method mismatches, schema drift.
              </p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold">Bob-Powered Fixes</h4>
              <p className="text-muted-foreground">
                Every finding includes "Prompt Bob to Fix" with full context. Copy, paste, and let Bob resolve the drift.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">
            Ready to Stop API Drift?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Try our interactive demo with a realistic broken repository
          </p>
          <Link
            href="/demo"
            className="inline-block px-8 py-4 bg-white text-purple-600 rounded-lg font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            Launch Demo →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>Built with ❤️ using IBM Bob for the IBM Bob Hackathon 2024</p>
          <p className="text-sm mt-2">
            Demonstrating how Bob's full repository context enables safer, faster development
          </p>
        </div>
      </footer>
    </div>
  );
}

// Made with Bob
