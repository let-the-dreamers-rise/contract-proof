'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Layers, Network, TrendingUp, FileCode, Zap } from 'lucide-react';
import { ImpactAnalyzer, ImpactGraph, BlastRadiusAnalysis, ImpactNode } from '@/lib/impact-analyzer';
import { DriftFinding } from '@/lib/types';

interface ImpactGraphProps {
  findings: DriftFinding[];
  selectedFinding?: DriftFinding;
  className?: string;
}

interface GraphPosition {
  x: number;
  y: number;
}

export function ImpactGraphComponent({ findings, selectedFinding, className = '' }: ImpactGraphProps) {
  const [impactGraph, setImpactGraph] = useState<ImpactGraph | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusAnalysis | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, GraphPosition>>(new Map());

  useEffect(() => {
    const analyzer = new ImpactAnalyzer();
    const graph = analyzer.analyzeFindings(findings);
    setImpactGraph(graph);

    if (selectedFinding) {
      const radius = analyzer.analyzeBlastRadius(selectedFinding, findings);
      setBlastRadius(radius);
    }

    // Calculate node positions using force-directed layout simulation
    if (graph.nodes.length > 0) {
      const positions = calculateNodePositions(graph);
      setNodePositions(positions);
    }
  }, [findings, selectedFinding]);

  useEffect(() => {
    if (impactGraph && canvasRef.current && nodePositions.size > 0) {
      drawGraph(canvasRef.current, impactGraph, nodePositions, hoveredNode, blastRadius);
    }
  }, [impactGraph, nodePositions, hoveredNode, blastRadius]);

  const calculateNodePositions = (graph: ImpactGraph): Map<string, GraphPosition> => {
    const positions = new Map<string, GraphPosition>();
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    if (graph.nodes.length === 0) return positions;

    // Simple circular layout for demo
    const radius = Math.min(width, height) * 0.35;
    const angleStep = (2 * Math.PI) / graph.nodes.length;

    graph.nodes.forEach((node, index) => {
      const angle = index * angleStep;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return positions;
  };

  const drawGraph = (
    canvas: HTMLCanvasElement,
    graph: ImpactGraph,
    positions: Map<string, GraphPosition>,
    hovered: string | null,
    blast: BlastRadiusAnalysis | null
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw edges first (so they appear behind nodes)
    ctx.lineWidth = 2;
    for (const edge of graph.edges) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);

      if (sourcePos && targetPos) {
        // Determine edge color based on type
        let edgeColor = '#cbd5e1';
        if (edge.type === 'calls') edgeColor = '#3b82f6';
        else if (edge.type === 'validates') edgeColor = '#10b981';
        else if (edge.type === 'implements') edgeColor = '#8b5cf6';

        // Highlight if connected to hovered node
        if (hovered && (edge.source === hovered || edge.target === hovered)) {
          edgeColor = '#f59e0b';
          ctx.lineWidth = 3;
        } else {
          ctx.lineWidth = 2;
        }

        ctx.strokeStyle = edgeColor;
        ctx.globalAlpha = edge.strength;

        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(targetPos.x, targetPos.y);
        ctx.lineTo(
          targetPos.x - arrowSize * Math.cos(angle - Math.PI / 6),
          targetPos.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          targetPos.x - arrowSize * Math.cos(angle + Math.PI / 6),
          targetPos.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = edgeColor;
        ctx.fill();

        ctx.globalAlpha = 1;
      }
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      // Determine node color based on severity
      let nodeColor = '#10b981'; // low
      if (node.severity === 'critical') nodeColor = '#ef4444';
      else if (node.severity === 'high') nodeColor = '#f97316';
      else if (node.severity === 'medium') nodeColor = '#eab308';

      // Highlight if hovered or in blast radius
      const isHovered = node.id === hovered;
      const isInBlastRadius = blast?.affectedNodes.some(n => n.id === node.id) || 
                              blast?.epicenter.id === node.id;

      const nodeRadius = isHovered ? 12 : isInBlastRadius ? 10 : 8;

      // Draw node shadow if hovered
      if (isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Draw node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = isHovered ? '#1e293b' : '#ffffff';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw node icon
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let icon = '●';
      if (node.type === 'endpoint') icon = 'E';
      else if (node.type === 'component') icon = 'C';
      else if (node.type === 'file') icon = 'F';
      else if (node.type === 'service') icon = 'S';
      
      ctx.fillText(icon, pos.x, pos.y);

      // Draw label if hovered or in blast radius
      if (isHovered || isInBlastRadius) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        const label = node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label;
        
        // Draw label background
        const labelWidth = ctx.measureText(label).width + 8;
        const labelHeight = 16;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(pos.x - labelWidth / 2, pos.y + nodeRadius + 4, labelWidth, labelHeight);
        
        // Draw label border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x - labelWidth / 2, pos.y + nodeRadius + 4, labelWidth, labelHeight);
        
        // Draw label text
        ctx.fillStyle = '#1e293b';
        ctx.fillText(label, pos.x, pos.y + nodeRadius + 12);
      }
    }

    // Draw legend
    drawLegend(ctx, width, height);
  };

  const drawLegend = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const legendX = 20;
    const legendY = height - 120;
    const legendWidth = 180;
    const legendHeight = 100;

    // Legend background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

    // Legend title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Severity', legendX + 10, legendY + 20);

    // Legend items
    const items = [
      { color: '#ef4444', label: 'Critical' },
      { color: '#f97316', label: 'High' },
      { color: '#eab308', label: 'Medium' },
      { color: '#10b981', label: 'Low' },
    ];

    items.forEach((item, index) => {
      const y = legendY + 40 + index * 18;
      
      // Draw color circle
      ctx.beginPath();
      ctx.arc(legendX + 15, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText(item.label, legendX + 30, y + 4);
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !impactGraph) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find node under cursor
    let foundNode: string | null = null;
    for (const node of impactGraph.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (distance <= 12) {
        foundNode = node.id;
        break;
      }
    }

    setHoveredNode(foundNode);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!impactGraph) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Network className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Impact Graph</h3>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Graph Visualization */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Dependency Impact Graph</h3>
          </div>
          <p className="text-sm text-gray-600">
            Visual representation of how drift affects your codebase
          </p>
        </div>

        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredNode(null)}
          className="w-full h-96 border rounded-lg cursor-pointer bg-white"
          style={{ width: '100%', height: '400px' }}
        />

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{impactGraph.metrics.totalNodes}</div>
            <div className="text-xs text-gray-600">Total Nodes</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{impactGraph.metrics.totalEdges}</div>
            <div className="text-xs text-gray-600">Connections</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{impactGraph.metrics.criticalNodes}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{impactGraph.metrics.highRiskNodes}</div>
            <div className="text-xs text-orange-600">High Risk</div>
          </div>
        </div>
      </div>

      {/* Blast Radius Analysis */}
      {blastRadius && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Blast Radius Analysis</h3>
            </div>
            <p className="text-sm text-gray-600">
              Impact assessment for selected drift issue
            </p>
          </div>

          <div className="space-y-4">
            {/* Risk Score */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className="text-3xl font-bold">{blastRadius.riskScore}/100</p>
              </div>
              <div className={`px-4 py-2 rounded-lg border-2 ${getSeverityColor(blastRadius.epicenter.severity)}`}>
                <p className="text-sm font-medium uppercase">{blastRadius.epicenter.severity}</p>
              </div>
            </div>

            {/* Affected Layers */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Affected Layers
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{blastRadius.affectedLayers.backend}</div>
                  <div className="text-xs text-blue-600">Backend</div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">{blastRadius.affectedLayers.frontend}</div>
                  <div className="text-xs text-purple-600">Frontend</div>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{blastRadius.affectedLayers.tests}</div>
                  <div className="text-xs text-green-600">Tests</div>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600">{blastRadius.affectedLayers.documentation}</div>
                  <div className="text-xs text-yellow-600">Docs</div>
                </div>
              </div>
            </div>

            {/* Estimated Impact */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Estimated Impact
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCode className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Files Affected</span>
                  </div>
                  <div className="text-lg font-bold">{blastRadius.estimatedImpact.filesAffected}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-gray-500" />
                    <span className="text-xs text-gray-600">Lines of Code</span>
                  </div>
                  <div className="text-lg font-bold">{blastRadius.estimatedImpact.linesOfCode}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-600">👥 Developers</span>
                  </div>
                  <div className="text-lg font-bold">{blastRadius.estimatedImpact.developersImpacted}</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-600">⏱️ Fix Time</span>
                  </div>
                  <div className="text-lg font-bold">{blastRadius.estimatedImpact.estimatedFixTime}h</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clusters */}
      {impactGraph.clusters.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Related Clusters</h3>
            <p className="text-sm text-gray-600">
              Groups of related endpoints affected by drift
            </p>
          </div>

          <div className="space-y-2">
            {impactGraph.clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(cluster.severity)}`}>
                      {cluster.severity}
                    </span>
                    <span className="font-medium">{cluster.label}</span>
                  </div>
                  <span className="text-sm text-gray-600">{cluster.nodeIds.length} nodes</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{cluster.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Made with Bob
