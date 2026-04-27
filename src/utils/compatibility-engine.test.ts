import { describe, it, expect } from 'vitest';
import { validateStack } from './compatibility-engine';

describe('Compatibility Engine Logic', () => {
  it('passes a correctly balanced stack', () => {
    const report = validateStack([
      { id: 'arm', title: 'Mic Arm', weightLimit: 2000 },
      { id: 'mic', title: 'Shure SM7B', weight: 764 }
    ]);
    expect(report.status).toBe('valid');
    expect(report.messages[0]).toContain('OPTIMAL');
  });

  it('flags an overloaded support node', () => {
    const report = validateStack([
      { id: 'arm', title: 'Small Arm', weightLimit: 500 },
      { id: 'mic', title: 'Shure SM7B', weight: 764 }
    ]);
    expect(report.status).toBe('error');
    expect(report.messages[0]).toContain('OVERLOAD');
  });

  it('warns when missing an XLR interface', () => {
    const report = validateStack([
      { id: 'mic', title: 'XLR Mic', interfaceType: 'XLR' }
    ]);
    expect(report.status).toBe('warning');
    expect(report.messages[0]).toContain('INTERFACE_MISSING');
  });
});
