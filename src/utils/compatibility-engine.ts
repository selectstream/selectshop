/**
 * SelectStream Compatibility Engine
 * Programmatically validates hardware and software stacks based on empirical technical constraints.
 */

export interface NodeSpec {
  id: string;
  title: string;
  weight?: number;
  weightLimit?: number;
  interfaceType?: string;
}

export interface CompatibilityReport {
  status: 'valid' | 'warning' | 'error';
  messages: string[];
}

export function validateStack(nodes: NodeSpec[]): CompatibilityReport {
  const messages: string[] = [];
  let status: 'valid' | 'warning' | 'error' = 'valid';

  // 1. Weight Validation (e.g., Mic Arm Capacity)
  const supports = nodes.filter(n => (n.weightLimit || 0) > 0);
  const payloads = nodes.filter(n => (n.weight || 0) > 0);

  supports.forEach(support => {
    const totalPayload = payloads.reduce((sum, p) => sum + (p.weight || 0), 0);
    if (support.weightLimit && totalPayload > support.weightLimit) {
      status = 'error';
      messages.push(`OVERLOAD: Total payload (${totalPayload}g) exceeds ${support.title} limit (${support.weightLimit}g).`);
    } else if (support.weightLimit && totalPayload > support.weightLimit * 0.8) {
      if (status !== 'error') status = 'warning';
      messages.push(`STRESS: Payload is at 80%+ capacity for ${support.title}.`);
    }
  });

  // 2. Interface Matching (Simplified)
  const xlrMics = nodes.filter(n => n.interfaceType === 'XLR' && !n.title.toLowerCase().includes('interface'));
  const xlrInterfaces = nodes.filter(n => n.interfaceType === 'XLR' && n.title.toLowerCase().includes('interface'));

  if (xlrMics.length > 0 && xlrInterfaces.length === 0) {
    if (status !== 'error') status = 'warning';
    messages.push(`INTERFACE_MISSING: XLR nodes detected but no Audio Interface (XLR) found in stack.`);
  }

  if (messages.length === 0) {
    messages.push('SYSTEM_INTEGRITY: OPTIMAL.');
  }

  return { status, messages };
}
