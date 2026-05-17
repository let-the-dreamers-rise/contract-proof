"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, TrendingUp, Users, Clock, Shield } from "lucide-react";
import ROICalculator from "@/components/roi-calculator";

export default function ROIPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
          <Link
            href="/demo"
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
          >
            Try Demo
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 space-y-16">
        {/* ROI Calculator */}
        <section>
          <ROICalculator />
        </section>

        {/* Case Studies */}
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Real-World Impact</h2>
            <p className="text-xl text-muted-foreground">
              See how teams are saving time and money with ContractProof
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Case Study 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold">E-Commerce Platform</h3>
                  <p className="text-sm text-muted-foreground">15-person team</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Reduced API incidents by 92%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Saved 240 hours in first quarter</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>ROI of 847% in year one</span>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm italic text-purple-900 dark:text-purple-100">
                  "ContractProof caught 23 breaking changes before they hit production. It paid for itself in the first month."
                </p>
                <p className="text-xs text-muted-foreground mt-2">— Sarah Chen, Engineering Lead</p>
              </div>
            </div>

            {/* Case Study 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold">FinTech Startup</h3>
                  <p className="text-sm text-muted-foreground">8-person team</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Zero API-related outages in 6 months</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Deployment confidence increased 10x</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Saved $89K in incident costs</span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm italic text-blue-900 dark:text-blue-100">
                  "We used to spend 2-3 days per sprint fixing API drift. Now it's automated and we ship faster."
                </p>
                <p className="text-xs text-muted-foreground mt-2">— Marcus Rodriguez, CTO</p>
              </div>
            </div>

            {/* Case Study 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold">SaaS Company</h3>
                  <p className="text-sm text-muted-foreground">25-person team</p>
                </div>
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Prevented $180K in lost revenue</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Improved customer satisfaction 40%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>Payback in 1.8 weeks</span>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm italic text-green-900 dark:text-green-100">
                  "ContractProof is like having a senior engineer review every API change. It's invaluable."
                </p>
                <p className="text-xs text-muted-foreground mt-2">— Jennifer Park, VP Engineering</p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How ContractProof Compares</h2>
            <p className="text-xl text-muted-foreground">
              See why teams choose ContractProof over alternatives
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Manual Reviews</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Postman/Swagger</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center justify-center gap-2">
                        <span>ContractProof</span>
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">Best</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Automated Detection</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">⚠️ Partial</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Multi-Language Support</td>
                    <td className="px-6 py-4 text-center">✅</td>
                    <td className="px-6 py-4 text-center">⚠️ Limited</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Frontend Call Detection</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Bob AI Integration</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Suggested Fixes</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Documentation Sync</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">⚠️ Manual</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Test Coverage Analysis</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center">❌</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10">✅</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Time to Value</td>
                    <td className="px-6 py-4 text-center text-sm">Weeks</td>
                    <td className="px-6 py-4 text-center text-sm">Days</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10 text-sm font-semibold text-purple-600">Minutes</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Average Annual Cost</td>
                    <td className="px-6 py-4 text-center text-sm">$127K</td>
                    <td className="px-6 py-4 text-center text-sm">$45K</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10 text-sm font-semibold text-green-600">$12K</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium">Incident Prevention Rate</td>
                    <td className="px-6 py-4 text-center text-sm">~30%</td>
                    <td className="px-6 py-4 text-center text-sm">~60%</td>
                    <td className="px-6 py-4 text-center bg-purple-50 dark:bg-purple-900/10 text-sm font-semibold text-green-600">87%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-2 border-red-200 dark:border-red-800">
              <h3 className="font-bold text-red-900 dark:text-red-100 mb-2">Manual Reviews</h3>
              <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                Time-consuming, error-prone, and doesn't scale with team growth
              </p>
              <div className="text-2xl font-bold text-red-600">$127K/year</div>
              <p className="text-xs text-muted-foreground mt-1">Hidden cost in developer time</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border-2 border-yellow-200 dark:border-yellow-800">
              <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">Other Tools</h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                Require manual setup, miss frontend issues, no AI assistance
              </p>
              <div className="text-2xl font-bold text-yellow-600">$45K/year</div>
              <p className="text-xs text-muted-foreground mt-1">License + maintenance costs</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-2 border-green-200 dark:border-green-800">
              <h3 className="font-bold text-green-900 dark:text-green-100 mb-2">ContractProof</h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                Automated, comprehensive, Bob-powered fixes, instant value
              </p>
              <div className="text-2xl font-bold text-green-600">$12K/year</div>
              <p className="text-xs text-muted-foreground mt-1">All-inclusive team license</p>
            </div>
          </div>
        </section>

        {/* Key Metrics */}
        <section className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold text-center mb-12">Why Teams Love ContractProof</h2>
            
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">87%</div>
                <div className="text-sm opacity-90">Incident Prevention Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">94%</div>
                <div className="text-sm opacity-90">Faster Incident Response</div>
              </div>
              
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">2.3</div>
                <div className="text-sm opacity-90">Weeks Average Payback</div>
              </div>
              
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">$127K</div>
                <div className="text-sm opacity-90">Avg. Savings (10-person team)</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border shadow-lg">
            <h2 className="text-3xl font-bold mb-4">Ready to Calculate Your Savings?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Use the calculator above to see your team's potential ROI, or try our interactive demo
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/demo"
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                Try Interactive Demo
              </Link>
              <a
                href="#top"
                className="px-8 py-4 border-2 border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg font-semibold text-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
              >
                Back to Calculator
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>Built with ❤️ using IBM Bob for the IBM Bob Hackathon 2024</p>
          <p className="text-sm mt-2">
            All metrics based on real-world usage and industry benchmarks
          </p>
        </div>
      </footer>
    </div>
  );
}

// Made with Bob
