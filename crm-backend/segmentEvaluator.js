/**
 * Segment Evaluator utility for compiling and evaluating segment rules
 * against customers and their order history.
 */

/**
 * Parses a simple rule string (e.g. "lifetime_value > 50") into a structured condition.
 * Fallback for backwards compatibility with the simple API inputs.
 */
function parseSimpleRuleString(ruleStr) {
  if (typeof ruleStr !== 'string') return ruleStr;

  const trimmed = ruleStr.trim();
  
  // Match lifetime_value > X
  const ltvMatch = trimmed.match(/^lifetime_value\s*(>|<|>=|<=|==)\s*(\d+)$/);
  if (ltvMatch) {
    const [, operator, value] = ltvMatch;
    const opMap = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte', '==': 'eq' };
    return {
      type: 'condition',
      field: 'lifetime_value',
      operator: opMap[operator] || 'gt',
      value: Number(value)
    };
  }

  // Match order_count > X
  const countMatch = trimmed.match(/^order_count\s*(>|<|>=|<=|==)\s*(\d+)$/);
  if (countMatch) {
    const [, operator, value] = countMatch;
    const opMap = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte', '==': 'eq' };
    return {
      type: 'condition',
      field: 'order_count',
      operator: opMap[operator] || 'gt',
      value: Number(value)
    };
  }

  // Default fallback if we can't parse it structurally - return a rule that matches everything or does basic check
  if (trimmed === 'lifetime_value>0' || trimmed === 'all') {
    return {
      type: 'condition',
      field: 'lifetime_value',
      operator: 'gte',
      value: 0
    };
  }

  // Generic fallback: match field operator value
  const genericMatch = trimmed.match(/^([a-zA-Z_]+)\s*(>|<|>=|<=|==)\s*(.+)$/);
  if (genericMatch) {
    const [, field, operator, valStr] = genericMatch;
    const isNum = !isNaN(valStr) && valStr.trim() !== '';
    const opMap = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte', '==': 'eq' };
    return {
      type: 'condition',
      field: field,
      operator: opMap[operator] || 'eq',
      value: isNum ? Number(valStr) : valStr.replace(/['"]/g, '').trim()
    };
  }

  return {
    type: 'condition',
    field: 'lifetime_value',
    operator: 'gte',
    value: 0
  };
}

/**
 * Evaluates a single structured condition against a customer and their orders.
 */
function evaluateCondition(customer, customerOrders, condition) {
  const { field, operator, value } = condition;
  
  let fieldValue;
  
  // Resolve field value
  if (field === 'lifetime_value') {
    fieldValue = Number(customer.lifetime_value || 0);
  } else if (field === 'name') {
    fieldValue = customer.name || '';
  } else if (field === 'email') {
    fieldValue = customer.email || '';
  } else if (field === 'phone') {
    fieldValue = customer.phone || '';
  } else if (field === 'order_count') {
    fieldValue = customerOrders.length;
  } else if (field === 'total_spent') {
    fieldValue = customerOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  } else if (field === 'last_order_days') {
    if (customerOrders.length === 0) {
      // If no orders, let's treat it as high number (e.g. 9999 days)
      fieldValue = 9999;
    } else {
      // Find latest order date
      const dates = customerOrders.map(o => new Date(o.created_at || o.date).getTime());
      const maxDate = Math.max(...dates);
      const diffMs = Date.now() - maxDate;
      fieldValue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  } else {
    // Arbitrary customer field
    fieldValue = customer[field];
  }

  // Compare using operator
  const val = typeof fieldValue === 'number' ? Number(value) : value;

  switch (operator) {
    case 'gt':
      return fieldValue > val;
    case 'gte':
      return fieldValue >= val;
    case 'lt':
      return fieldValue < val;
    case 'lte':
      return fieldValue <= val;
    case 'eq':
      if (typeof fieldValue === 'string' && typeof val === 'string') {
        return fieldValue.toLowerCase() === val.toLowerCase();
      }
      return fieldValue == val;
    case 'neq':
      if (typeof fieldValue === 'string' && typeof val === 'string') {
        return fieldValue.toLowerCase() !== val.toLowerCase();
      }
      return fieldValue != val;
    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(String(val).toLowerCase());
      }
      return false;
    case 'in_last_days':
      return fieldValue <= Number(val);
    case 'more_than_days':
      return fieldValue > Number(val);
    default:
      return false;
  }
}

/**
 * Evaluates a rule node (condition or logical group) recursively.
 */
function evaluateNode(customer, customerOrders, node) {
  if (!node) return true;

  // Handle case where rule is simple string
  if (typeof node === 'string') {
    node = parseSimpleRuleString(node);
  }

  if (node.type === 'logical') {
    const { operator, conditions } = node;
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    
    if (operator === 'AND') {
      return conditions.every(c => evaluateNode(customer, customerOrders, c));
    } else if (operator === 'OR') {
      return conditions.some(c => evaluateNode(customer, customerOrders, c));
    }
    return true;
  }
  
  // Default type is condition
  return evaluateCondition(customer, customerOrders, node);
}

/**
 * Filter customers based on a segment rule and order list.
 * @param {Array} customers 
 * @param {Array} orders 
 * @param {Object|String} rule 
 * @returns {Array} List of matched customers
 */
function evaluateSegment(customers, orders, rule) {
  if (!customers || !Array.isArray(customers)) return [];
  if (!rule) return customers;

  // Group orders by customer_id for speed
  const ordersByCustomer = {};
  (orders || []).forEach(o => {
    const cId = o.customer_id || o.customerId;
    if (cId) {
      if (!ordersByCustomer[cId]) ordersByCustomer[cId] = [];
      ordersByCustomer[cId].push(o);
    }
  });

  return customers.filter(c => {
    const customerOrders = ordersByCustomer[c.id] || [];
    try {
      return evaluateNode(c, customerOrders, rule);
    } catch (err) {
      console.error('Error evaluating segment rule for customer', c.id, err);
      return false;
    }
  });
}

module.exports = {
  evaluateSegment,
  parseSimpleRuleString
};
