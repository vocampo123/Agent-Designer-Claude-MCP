import type { Action, ActionExecutionLog } from '../types/agent.js';

type SmartMockFn = (inputs: Record<string, any>) => Record<string, any>;

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  const us = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (us) return new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]));
  const natural = new Date(dateStr);
  return isNaN(natural.getTime()) ? null : natural;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function deliveryDate(method: string): string {
  const days = method?.toLowerCase() === 'shipping' ? 5 : 0;
  return formatDate(new Date(Date.now() + days * 86400000));
}

const SMART_MOCKS: Record<string, SmartMockFn> = {
  calculate_days_until_start: (inputs) => {
    const d = parseDate(inputs.start_date || inputs.startDate || inputs.date);
    if (!d) return { days_diff: 10, can_ship: true };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    const canShip = diff >= 5;
    return { days_diff: Math.max(0, diff), can_ship: canShip, today: formatDate(today), start_date: formatDate(d) };
  },

  check_inventory: (inputs) => {
    const item = (inputs.item || inputs.equipment || inputs.product || '').toLowerCase();
    if (item.includes('macbook pro') || item.includes('executive')) {
      return { status: 'Out of Stock', available: false, eta: '2 weeks', alternatives: ['MacBook Air', 'ThinkPad X1'] };
    }
    if (item.includes('performance')) {
      return { status: 'Limited Stock', available: true, quantity: 3, eta: 'Immediate' };
    }
    return { status: 'Available', available: true, quantity: 25, eta: 'Immediate' };
  },

  check_user_permissions: (inputs) => {
    const role = inputs.role || inputs.user_role || 'Manager';
    if (role.toLowerCase() === 'contractor') {
      return { role: 'Contractor', authorized: false, message: 'Contractors cannot submit equipment requests.' };
    }
    return { role, authorized: true, permissions: ['request_equipment', 'view_inventory', 'submit_orders'] };
  },

  submit_hardware_request: (inputs) => {
    const ts = Date.now().toString().slice(-6);
    return {
      request_id: `REQ-${ts}`,
      order_id: `ORD-${ts}`,
      status: 'Submitted',
      estimated_delivery: deliveryDate(inputs.method || inputs.fulfillment_method),
      confirmation: `Your request for ${inputs.item || inputs.equipment || 'equipment'} has been submitted.`,
    };
  },

  submit_return_request: (inputs) => {
    const ts = Date.now().toString().slice(-6);
    return {
      return_id: `RET-${ts}`,
      status: 'Approved',
      instructions: 'Please drop off your device at the IT desk (Building A, Room 102) by end of business Friday.',
    };
  },

  submit_general_request: () => {
    const ts = Date.now().toString().slice(-6);
    return { request_id: `GEN-${ts}`, status: 'Submitted', message: 'Your request has been submitted for review.' };
  },
};

export class MockActionEngine {
  private overrides = new Map<string, Record<string, any>>();
  private log: ActionExecutionLog[] = [];
  private smartMocksEnabled = true;

  execute(action: Action, inputs: Record<string, any>): Record<string, any> {
    const start = Date.now();
    let outputs: Record<string, any>;

    if (this.overrides.has(action.name)) {
      outputs = this.overrides.get(action.name)!;
    } else if (this.smartMocksEnabled) {
      const fn = SMART_MOCKS[action.name] ?? this.matchByPattern(action.name);
      outputs = fn ? fn(inputs) : this.defaultOutputs(action, inputs);
    } else {
      outputs = this.defaultOutputs(action, inputs);
    }

    this.log.push({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
      actionName: action.name,
      inputs: { ...inputs },
      outputs: { ...outputs },
      status: 'success',
      duration: Date.now() - start,
    });

    return outputs;
  }

  setMockResponse(name: string, outputs: Record<string, any>): void {
    this.overrides.set(name, outputs);
  }

  clearMockResponse(name: string): void { this.overrides.delete(name); }
  clearAll(): void { this.overrides.clear(); }
  getLog(): ActionExecutionLog[] { return [...this.log]; }
  clearLog(): void { this.log = []; }

  getMockOverrides(): Record<string, Record<string, any>> {
    const result: Record<string, Record<string, any>> = {};
    this.overrides.forEach((v, k) => { result[k] = { ...v }; });
    return result;
  }

  restoreOverrides(overrides: Record<string, Record<string, any>>): void {
    this.overrides.clear();
    for (const [k, v] of Object.entries(overrides)) this.overrides.set(k, v);
  }

  private matchByPattern(name: string): SmartMockFn | null {
    const n = name.toLowerCase();
    if (n.includes('days') || (n.includes('date') && n.includes('calc'))) return SMART_MOCKS['calculate_days_until_start'];
    if (n.includes('inventory') || n.includes('stock')) return SMART_MOCKS['check_inventory'];
    if (n.includes('permission') || n.includes('auth')) return SMART_MOCKS['check_user_permissions'];
    if (n.includes('submit') && n.includes('return')) return SMART_MOCKS['submit_return_request'];
    if (n.includes('submit') && (n.includes('hardware') || n.includes('equipment'))) return SMART_MOCKS['submit_hardware_request'];
    if (n.includes('submit')) return SMART_MOCKS['submit_general_request'];
    return null;
  }

  private defaultOutputs(action: Action, inputs: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const o of action.outputs ?? []) {
      out[o.name] = this.mockValue(o.name, o.type);
    }
    return out;
  }

  private mockValue(name: string, type: string): any {
    const n = name.toLowerCase();
    if (n.includes('role') || n === 'user_role') return 'Manager';
    if (n.includes('authorized') || n.includes('permission') || n.includes('allowed')) return true;
    if (n.includes('status')) return 'Success';
    if (n.includes('_id') || n.endsWith('id')) return `001${Math.random().toString(36).slice(2, 14).toUpperCase()}`;
    if (n.includes('count') || n.includes('total') || n.includes('days')) return 7;
    if (n.includes('success') || n.includes('valid') || n.includes('exists')) return true;
    switch (type) {
      case 'boolean': return true;
      case 'number': return 10;
      case 'date': return new Date().toISOString().split('T')[0];
      case 'id': return `001${Math.random().toString(36).slice(2, 14).toUpperCase()}`;
      default: return `mock_${name}`;
    }
  }
}
