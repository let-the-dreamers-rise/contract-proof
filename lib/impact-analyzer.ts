/**
 * Impact Analyzer
 * Analyzes the blast radius and dependency chains of API drift
 */

import { DriftFinding, ApiEndpoint } from './types';

export interface ImpactNode {
  id: string;
  type: 'endpoint' | 'file' | 'component' | 'service';
  label: string;
  path?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedBy: string[]; // IDs of nodes that affect this one
  affects: string[]; // IDs of nodes this one affects
  metadata: {
    method?: string;
    framework?: string;
    lineCount?: number;
    dependencies?: string[];
  };
}

export interface ImpactEdge {
  id: string;
  source: string;
  target: string;
  type: 'depends_on' | 'calls' | 'implements' | 'validates';
  strength: number; // 0-1, how strong the dependency is
  bidirectional: boolean;
}

export interface ImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  clusters: ImpactCluster[];
  metrics: ImpactMetrics;
}

export interface ImpactCluster {
  id: string;
  label: string;
  nodeIds: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface ImpactMetrics {
  totalNodes: number;
  totalEdges: number;
  criticalNodes: number;
  highRiskNodes: number;
  averageConnections: number;
  maxDepth: number;
  isolatedNodes: number;
  blastRadius: number; // Percentage of codebase affected
}

export interface BlastRadiusAnalysis {
  epicenter: ImpactNode;
  affectedNodes: ImpactNode[];
  affectedLayers: {
    backend: number;
    frontend: number;
    tests: number;
    documentation: number;
  };
  estimatedImpact: {
    filesAffected: number;
    linesOfCode: number;
    developersImpacted: number;
    estimatedFixTime: number; // in hours
  };
  riskScore: number; // 0-100
}

export class ImpactAnalyzer {
  private nodes: Map<string, ImpactNode> = new Map();
  private edges: ImpactEdge[] = [];

  /**
   * Analyze impact from drift findings
   */
  analyzeFindings(findings: DriftFinding[]): ImpactGraph {
    this.nodes.clear();
    this.edges = [];

    // Build graph from findings
    for (const finding of findings) {
      this.addFindingToGraph(finding);
    }

    // Detect clusters
    const clusters = this.detectClusters();

    // Calculate metrics
    const metrics = this.calculateMetrics();

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      clusters,
      metrics,
    };
  }

  /**
   * Analyze blast radius for a specific drift
   */
  analyzeBlastRadius(finding: DriftFinding, allFindings: DriftFinding[]): BlastRadiusAnalysis {
    // Build full graph
    this.analyzeFindings(allFindings);

    // Find epicenter node
    const epicenterId = this.generateNodeId('endpoint', finding.backend?.path || finding.id);
    const epicenter = this.nodes.get(epicenterId);

    if (!epicenter) {
      // Return minimal analysis if epicenter not found
      return this.createMinimalBlastRadius(finding);
    }

    // Find all affected nodes using BFS
    const affectedNodes = this.findAffectedNodes(epicenter);

    // Analyze affected layers
    const affectedLayers = this.analyzeAffectedLayers(affectedNodes);

    // Estimate impact
    const estimatedImpact = this.estimateImpact(affectedNodes, finding);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(finding, affectedNodes, estimatedImpact);

    return {
      epicenter,
      affectedNodes,
      affectedLayers,
      estimatedImpact,
      riskScore,
    };
  }

  /**
   * Add a drift finding to the graph
   */
  private addFindingToGraph(finding: DriftFinding): void {
    // Add backend node
    if (finding.backend) {
      const backendNode = this.createNodeFromEndpoint(finding.backend, finding.severity);
      this.nodes.set(backendNode.id, backendNode);
    }

    // Add frontend nodes
    if (finding.frontend) {
      for (const frontendEndpoint of finding.frontend) {
        const frontendNode = this.createNodeFromEndpoint(frontendEndpoint, finding.severity);
        this.nodes.set(frontendNode.id, frontendNode);

        // Create edge from frontend to backend
        if (finding.backend) {
          const backendId = this.generateNodeId('endpoint', finding.backend.path);
          this.edges.push({
            id: `${frontendNode.id}->${backendId}`,
            source: frontendNode.id,
            target: backendId,
            type: 'calls',
            strength: 0.9,
            bidirectional: false,
          });
        }
      }
    }

    // Add documentation nodes
    if (finding.documentation) {
      for (const docEndpoint of finding.documentation) {
        const docNode = this.createNodeFromEndpoint(docEndpoint, finding.severity);
        this.nodes.set(docNode.id, docNode);

        // Create edge from documentation to backend
        if (finding.backend) {
          const backendId = this.generateNodeId('endpoint', finding.backend.path);
          this.edges.push({
            id: `${docNode.id}->${backendId}`,
            source: docNode.id,
            target: backendId,
            type: 'validates',
            strength: 0.7,
            bidirectional: false,
          });
        }
      }
    }

    // Add test nodes
    if (finding.tests) {
      for (const testEndpoint of finding.tests) {
        const testNode = this.createNodeFromEndpoint(testEndpoint, finding.severity);
        this.nodes.set(testNode.id, testNode);

        // Create edge from test to backend
        if (finding.backend) {
          const backendId = this.generateNodeId('endpoint', finding.backend.path);
          this.edges.push({
            id: `${testNode.id}->${backendId}`,
            source: testNode.id,
            target: backendId,
            type: 'validates',
            strength: 0.8,
            bidirectional: false,
          });
        }
      }
    }

    // Add file nodes
    const files = new Set<string>();
    if (finding.backend?.location.file) files.add(finding.backend.location.file);
    if (finding.frontend) {
      finding.frontend.forEach(f => {
        if (f.location.file) files.add(f.location.file);
      });
    }

    for (const file of files) {
      const fileNode: ImpactNode = {
        id: this.generateNodeId('file', file),
        type: 'file',
        label: file.split('/').pop() || file,
        path: file,
        severity: finding.severity,
        affectedBy: [],
        affects: [],
        metadata: {},
      };
      this.nodes.set(fileNode.id, fileNode);
    }
  }

  /**
   * Create a node from an API endpoint
   */
  private createNodeFromEndpoint(endpoint: ApiEndpoint, severity: DriftFinding['severity']): ImpactNode {
    const nodeType = endpoint.type === 'backend' ? 'endpoint' : 
                     endpoint.type === 'frontend' ? 'component' : 
                     endpoint.type === 'test' ? 'component' : 'endpoint';

    return {
      id: this.generateNodeId(nodeType, endpoint.path),
      type: nodeType,
      label: `${endpoint.method} ${endpoint.path}`,
      path: endpoint.path,
      severity,
      affectedBy: [],
      affects: [],
      metadata: {
        method: endpoint.method,
        framework: endpoint.framework,
        dependencies: endpoint.params,
      },
    };
  }

  /**
   * Generate a unique node ID
   */
  private generateNodeId(type: string, identifier: string): string {
    return `${type}:${identifier}`;
  }

  /**
   * Detect clusters of related nodes
   */
  private detectClusters(): ImpactCluster[] {
    const clusters: ImpactCluster[] = [];
    const visited = new Set<string>();

    // Group by endpoint path prefix
    const pathGroups = new Map<string, ImpactNode[]>();

    for (const node of this.nodes.values()) {
      if (node.type === 'endpoint' && node.path) {
        const prefix = node.path.split('/').slice(0, 3).join('/'); // e.g., /api/users
        if (!pathGroups.has(prefix)) {
          pathGroups.set(prefix, []);
        }
        pathGroups.get(prefix)!.push(node);
      }
    }

    // Create clusters from groups
    for (const [prefix, nodes] of pathGroups.entries()) {
      if (nodes.length >= 2) {
        const severities = nodes.map(n => n.severity);
        const maxSeverity = this.getMaxSeverity(severities);

        clusters.push({
          id: `cluster-${prefix.replace(/\//g, '-')}`,
          label: prefix || 'Root',
          nodeIds: nodes.map(n => n.id),
          severity: maxSeverity,
          description: `${nodes.length} related endpoints in ${prefix}`,
        });

        nodes.forEach(n => visited.add(n.id));
      }
    }

    return clusters;
  }

  /**
   * Calculate graph metrics
   */
  private calculateMetrics(): ImpactMetrics {
    const nodes = Array.from(this.nodes.values());
    const totalNodes = nodes.length;
    const totalEdges = this.edges.length;

    const criticalNodes = nodes.filter(n => n.severity === 'critical').length;
    const highRiskNodes = nodes.filter(n => n.severity === 'high').length;

    const connectionCounts = nodes.map(n => {
      const incoming = this.edges.filter(e => e.target === n.id).length;
      const outgoing = this.edges.filter(e => e.source === n.id).length;
      return incoming + outgoing;
    });

    const averageConnections = totalNodes > 0
      ? connectionCounts.reduce((a, b) => a + b, 0) / totalNodes
      : 0;

    const isolatedNodes = nodes.filter(n => {
      const hasConnections = this.edges.some(e => e.source === n.id || e.target === n.id);
      return !hasConnections;
    }).length;

    // Calculate max depth using BFS
    const maxDepth = this.calculateMaxDepth();

    // Estimate blast radius (percentage of codebase affected)
    const blastRadius = totalNodes > 0 ? Math.min(100, (totalNodes / 100) * 100) : 0;

    return {
      totalNodes,
      totalEdges,
      criticalNodes,
      highRiskNodes,
      averageConnections: Math.round(averageConnections * 10) / 10,
      maxDepth,
      isolatedNodes,
      blastRadius: Math.round(blastRadius),
    };
  }

  /**
   * Find all nodes affected by a given node using BFS
   */
  private findAffectedNodes(epicenter: ImpactNode): ImpactNode[] {
    const affected: ImpactNode[] = [];
    const visited = new Set<string>();
    const queue: string[] = [epicenter.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      const currentNode = this.nodes.get(currentId);
      if (currentNode && currentNode.id !== epicenter.id) {
        affected.push(currentNode);
      }

      // Find all nodes that depend on this one
      const dependentEdges = this.edges.filter(e => e.source === currentId);
      for (const edge of dependentEdges) {
        if (!visited.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    return affected;
  }

  /**
   * Analyze which layers are affected
   */
  private analyzeAffectedLayers(nodes: ImpactNode[]): BlastRadiusAnalysis['affectedLayers'] {
    return {
      backend: nodes.filter(n => n.type === 'endpoint').length,
      frontend: nodes.filter(n => n.type === 'component').length,
      tests: nodes.filter(n => n.type === 'component' && n.path?.includes('test')).length,
      documentation: nodes.filter(n => n.type === 'endpoint' && n.path?.includes('doc')).length,
    };
  }

  /**
   * Estimate the impact of a drift
   */
  private estimateImpact(
    affectedNodes: ImpactNode[],
    finding: DriftFinding
  ): BlastRadiusAnalysis['estimatedImpact'] {
    const filesAffected = new Set(affectedNodes.map(n => n.path).filter(Boolean)).size;
    const linesOfCode = filesAffected * 50; // Rough estimate: 50 lines per file
    const developersImpacted = Math.ceil(filesAffected / 3); // Rough estimate: 1 dev per 3 files

    // Estimate fix time based on severity and affected nodes
    let estimatedFixTime = 0;
    switch (finding.severity) {
      case 'critical':
        estimatedFixTime = 2 + affectedNodes.length * 0.5;
        break;
      case 'high':
        estimatedFixTime = 1 + affectedNodes.length * 0.3;
        break;
      case 'medium':
        estimatedFixTime = 0.5 + affectedNodes.length * 0.2;
        break;
      case 'low':
        estimatedFixTime = 0.25 + affectedNodes.length * 0.1;
        break;
    }

    return {
      filesAffected,
      linesOfCode,
      developersImpacted,
      estimatedFixTime: Math.round(estimatedFixTime * 10) / 10,
    };
  }

  /**
   * Calculate risk score for blast radius
   */
  private calculateRiskScore(
    finding: DriftFinding,
    affectedNodes: ImpactNode[],
    impact: BlastRadiusAnalysis['estimatedImpact']
  ): number {
    let score = 0;

    // Severity weight (0-40 points)
    switch (finding.severity) {
      case 'critical':
        score += 40;
        break;
      case 'high':
        score += 30;
        break;
      case 'medium':
        score += 20;
        break;
      case 'low':
        score += 10;
        break;
    }

    // Affected nodes weight (0-30 points)
    score += Math.min(30, affectedNodes.length * 3);

    // Files affected weight (0-20 points)
    score += Math.min(20, impact.filesAffected * 2);

    // Fix time weight (0-10 points)
    score += Math.min(10, impact.estimatedFixTime);

    return Math.min(100, Math.round(score));
  }

  /**
   * Calculate maximum depth of the dependency graph
   */
  private calculateMaxDepth(): number {
    let maxDepth = 0;

    for (const node of this.nodes.values()) {
      const depth = this.calculateNodeDepth(node.id, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  /**
   * Calculate depth of a specific node
   */
  private calculateNodeDepth(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const outgoingEdges = this.edges.filter(e => e.source === nodeId);
    if (outgoingEdges.length === 0) return 1;

    let maxChildDepth = 0;
    for (const edge of outgoingEdges) {
      const childDepth = this.calculateNodeDepth(edge.target, new Set(visited));
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  /**
   * Get maximum severity from a list
   */
  private getMaxSeverity(severities: Array<'critical' | 'high' | 'medium' | 'low'>): 'critical' | 'high' | 'medium' | 'low' {
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Create minimal blast radius analysis when epicenter not found
   */
  private createMinimalBlastRadius(finding: DriftFinding): BlastRadiusAnalysis {
    const epicenter: ImpactNode = {
      id: finding.id,
      type: 'endpoint',
      label: finding.title,
      severity: finding.severity,
      affectedBy: [],
      affects: [],
      metadata: {},
    };

    return {
      epicenter,
      affectedNodes: [],
      affectedLayers: {
        backend: finding.backend ? 1 : 0,
        frontend: finding.frontend?.length || 0,
        tests: finding.tests?.length || 0,
        documentation: finding.documentation?.length || 0,
      },
      estimatedImpact: {
        filesAffected: 1,
        linesOfCode: 50,
        developersImpacted: 1,
        estimatedFixTime: 1,
      },
      riskScore: finding.severity === 'critical' ? 80 : finding.severity === 'high' ? 60 : 40,
    };
  }
}

// Made with Bob
