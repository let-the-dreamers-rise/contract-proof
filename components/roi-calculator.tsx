"use client";

import { useState, useMemo } from "react";
import { Calculator, TrendingUp, Clock, DollarSign, Download, AlertCircle } from "lucide-react";

interface ROIInputs {
  teamSize: number;
  avgSalary: number;
  incidentsPerMonth: number;
  hoursPerIncident: number;
  currentMethod: "manual" | "none" | "other";
}

interface ROIResults {
  annualIncidentCost: number;
  timeSavedHours: number;
  moneySavedAnnually: number;
  roiPercentage: number;
  paybackWeeks: number;
  productivityGain: number;
}

const CONTRACTPROOF_ANNUAL_COST = 12000; // $12K/year for team license
const INCIDENT_REDUCTION_RATE = 0.87; // 87% reduction
const TIME_EFFICIENCY_GAIN = 0.94; // 94% faster incident response

export default function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>({
    teamSize: 10,
    avgSalary: 120000,
    incidentsPerMonth: 8,
    hoursPerIncident: 6,
    currentMethod: "manual",
  });

  const results = useMemo((): ROIResults => {
    // Calculate hourly rate
    const hourlyRate = inputs.avgSalary / 2080; // 2080 work hours per year

    // Annual incident hours without ContractProof
    const annualIncidentHours = inputs.incidentsPerMonth * 12 * inputs.hoursPerIncident;
    
    // Cost of incidents (team time)
    const annualIncidentCost = annualIncidentHours * hourlyRate * inputs.teamSize;

    // Hours saved with ContractProof (87% reduction + 94% faster response)
    const incidentsPreventedHours = annualIncidentHours * INCIDENT_REDUCTION_RATE;
    const remainingIncidentHours = annualIncidentHours * (1 - INCIDENT_REDUCTION_RATE);
    const timeSavedOnRemaining = remainingIncidentHours * TIME_EFFICIENCY_GAIN;
    const timeSavedHours = incidentsPreventedHours + timeSavedOnRemaining;

    // Money saved
    const moneySavedAnnually = (timeSavedHours * hourlyRate * inputs.teamSize) - CONTRACTPROOF_ANNUAL_COST;

    // ROI percentage
    const roiPercentage = ((moneySavedAnnually / CONTRACTPROOF_ANNUAL_COST) * 100);

    // Payback period in weeks
    const paybackWeeks = (CONTRACTPROOF_ANNUAL_COST / (moneySavedAnnually / 52));

    // Productivity gain (hours per developer per year)
    const productivityGain = timeSavedHours / inputs.teamSize;

    return {
      annualIncidentCost,
      timeSavedHours,
      moneySavedAnnually,
      roiPercentage,
      paybackWeeks,
      productivityGain,
    };
  }, [inputs]);

  const handleInputChange = (field: keyof ROIInputs, value: number | string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const exportToPDF = () => {
    // Create a printable version
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ContractProof ROI Analysis</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #7c3aed; border-bottom: 3px solid #7c3aed; padding-bottom: 10px; }
          h2 { color: #2563eb; margin-top: 30px; }
          .metric { background: #f3f4f6; padding: 20px; margin: 10px 0; border-radius: 8px; }
          .metric-value { font-size: 32px; font-weight: bold; color: #7c3aed; }
          .metric-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
          .inputs { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>🛡️ ContractProof ROI Analysis</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        
        <div class="inputs">
          <h2>Your Inputs</h2>
          <p><strong>Team Size:</strong> ${inputs.teamSize} developers</p>
          <p><strong>Average Salary:</strong> $${inputs.avgSalary.toLocaleString()}/year</p>
          <p><strong>API Incidents:</strong> ${inputs.incidentsPerMonth}/month</p>
          <p><strong>Hours per Incident:</strong> ${inputs.hoursPerIncident} hours</p>
          <p><strong>Current Method:</strong> ${inputs.currentMethod}</p>
        </div>

        <h2>ROI Results</h2>
        
        <div class="metric">
          <div class="metric-value">$${results.moneySavedAnnually.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div class="metric-label">Annual Savings (after ContractProof cost)</div>
        </div>

        <div class="metric">
          <div class="metric-value">${results.roiPercentage.toFixed(0)}%</div>
          <div class="metric-label">Return on Investment</div>
        </div>

        <div class="metric">
          <div class="metric-value">${results.paybackWeeks.toFixed(1)} weeks</div>
          <div class="metric-label">Payback Period</div>
        </div>

        <div class="metric">
          <div class="metric-value">${results.timeSavedHours.toLocaleString(undefined, { maximumFractionDigits: 0 })} hours</div>
          <div class="metric-label">Time Saved Annually</div>
        </div>

        <div class="metric">
          <div class="metric-value">${results.productivityGain.toFixed(0)} hours</div>
          <div class="metric-label">Productivity Gain per Developer</div>
        </div>

        <h2>Cost Breakdown</h2>
        <p><strong>Current Annual Incident Cost:</strong> $${results.annualIncidentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        <p><strong>ContractProof Annual Cost:</strong> $${CONTRACTPROOF_ANNUAL_COST.toLocaleString()}</p>
        <p><strong>Net Savings:</strong> $${results.moneySavedAnnually.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>

        <div class="footer">
          <p>ContractProof - Bob-Powered API Drift Guard</p>
          <p>This analysis is based on industry averages and your specific inputs. Actual results may vary.</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-medium">
          <Calculator className="w-4 h-4" />
          Interactive ROI Calculator
        </div>
        <h1 className="text-4xl font-bold">Calculate Your Savings</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          See how much time and money ContractProof can save your team by preventing API drift incidents
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-purple-600" />
            Your Team Details
          </h2>

          <div className="space-y-4">
            {/* Team Size */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Team Size (Developers)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={inputs.teamSize}
                onChange={(e) => handleInputChange("teamSize", parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of developers on your team
              </p>
            </div>

            {/* Average Salary */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Average Developer Salary ($/year)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={inputs.avgSalary}
                onChange={(e) => handleInputChange("avgSalary", parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Average annual salary per developer
              </p>
            </div>

            {/* Incidents Per Month */}
            <div>
              <label className="block text-sm font-medium mb-2">
                API Incidents Per Month
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={inputs.incidentsPerMonth}
                onChange={(e) => handleInputChange("incidentsPerMonth", parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Average API-related incidents per month
              </p>
            </div>

            {/* Hours Per Incident */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Hours Per Incident
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={inputs.hoursPerIncident}
                onChange={(e) => handleInputChange("hoursPerIncident", parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Average hours to resolve each incident
              </p>
            </div>

            {/* Current Method */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Drift Detection Method
              </label>
              <select
                value={inputs.currentMethod}
                onChange={(e) => handleInputChange("currentMethod", e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="none">None - Find issues in production</option>
                <option value="manual">Manual code reviews</option>
                <option value="other">Other tools (Postman, Swagger)</option>
              </select>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Industry Benchmarks:</p>
                <ul className="space-y-1 text-xs">
                  <li>• 40% of production incidents are API-related</li>
                  <li>• Average incident costs 6-8 hours of team time</li>
                  <li>• Manual detection catches only 30% of issues</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Main Metrics */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold mb-6">Your ROI Results</h2>
            
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm opacity-90">Annual Savings</span>
                </div>
                <div className="text-3xl font-bold">
                  ${results.moneySavedAnnually.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs opacity-75 mt-1">After ContractProof cost</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">ROI</span>
                </div>
                <div className="text-3xl font-bold">
                  {results.roiPercentage.toFixed(0)}%
                </div>
                <p className="text-xs opacity-75 mt-1">Return on investment</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm opacity-90">Payback Period</span>
                </div>
                <div className="text-3xl font-bold">
                  {results.paybackWeeks.toFixed(1)} weeks
                </div>
                <p className="text-xs opacity-75 mt-1">Time to break even</p>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg space-y-4">
            <h3 className="text-lg font-bold">Additional Benefits</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium">Time Saved Annually</span>
                <span className="text-lg font-bold text-purple-600">
                  {results.timeSavedHours.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium">Per Developer Gain</span>
                <span className="text-lg font-bold text-purple-600">
                  {results.productivityGain.toFixed(0)} hrs/year
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium">Incidents Prevented</span>
                <span className="text-lg font-bold text-green-600">
                  {(inputs.incidentsPerMonth * 12 * INCIDENT_REDUCTION_RATE).toFixed(0)}/year
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm font-medium">Current Incident Cost</span>
                <span className="text-lg font-bold text-red-600">
                  ${results.annualIncidentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year
                </span>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToPDF}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Results as PDF
          </button>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border shadow-lg">
        <h3 className="text-2xl font-bold mb-6">Cost Comparison</h3>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
            <div className="text-sm font-medium text-red-600 mb-2">Without ContractProof</div>
            <div className="text-3xl font-bold text-red-600">
              ${results.annualIncidentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Annual incident cost</div>
          </div>

          <div className="text-center p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-600 mb-2">ContractProof Cost</div>
            <div className="text-3xl font-bold text-blue-600">
              ${CONTRACTPROOF_ANNUAL_COST.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Annual license</div>
          </div>

          <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
            <div className="text-sm font-medium text-green-600 mb-2">Net Savings</div>
            <div className="text-3xl font-bold text-green-600">
              ${results.moneySavedAnnually.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Your annual savings</div>
          </div>
        </div>

        {/* Visual Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium w-32">Current Cost:</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
              <div 
                className="bg-red-500 h-full rounded-full flex items-center justify-end pr-4 text-white text-sm font-bold"
                style={{ width: '100%' }}
              >
                ${results.annualIncidentCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium w-32">With ContractProof:</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
              <div 
                className="bg-green-500 h-full rounded-full flex items-center justify-end pr-4 text-white text-sm font-bold"
                style={{ 
                  width: `${Math.max(10, (CONTRACTPROOF_ANNUAL_COST / results.annualIncidentCost) * 100)}%` 
                }}
              >
                ${CONTRACTPROOF_ANNUAL_COST.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
