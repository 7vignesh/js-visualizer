import * as parser from '@babel/parser';

/**
 * Simple type inference engine for JavaScript/TypeScript
 * Detects types from variable assignments, function parameters, and return types
 */

export function inferTypes(code) {
  const types = new Map(); // lineNum -> { position, symbol, type, error? }
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        ['decorators', { decoratorsBeforeExport: false }]
      ]
    });

    // Walk the AST and collect type information
    walkAST(ast, code, types);
  } catch (err) {
    console.warn('Type inference parse error:', err.message);
  }

  return types;
}

function walkAST(node, code, types, parent = null) {
  if (!node) return;

  // Variable declarations with type annotations
  if (node.type === 'VariableDeclarator' && node.id) {
    if (node.id.typeAnnotation) {
      const type = extractType(node.id.typeAnnotation);
      if (node.id.loc) {
        addType(types, node.id.loc.start.line, node.id.name, type);
      }
    } else if (node.init) {
      // Infer type from initializer
      const type = inferValueType(node.init);
      if (type && node.id.loc) {
        addType(types, node.id.loc.start.line, node.id.name, type);
      }
    }
  }

  // Function parameters with type annotations
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    if (node.params) {
      node.params.forEach(param => {
        if (param.typeAnnotation && param.loc) {
          const type = extractType(param.typeAnnotation);
          addType(types, param.loc.start.line, param.name, type);
        }
      });
    }
    // Check return type
    if (node.returnType && node.loc) {
      const type = extractType(node.returnType);
      addType(types, node.loc.start.line, node.id?.name || 'anonymous', `→ ${type}`);
    }
  }

  // Type aliases and interfaces
  if (node.type === 'TSTypeAliasDeclaration' && node.loc) {
    addType(types, node.loc.start.line, node.id.name, '= type');
  }
  if (node.type === 'TSInterfaceDeclaration' && node.loc) {
    addType(types, node.loc.start.line, node.id.name, '= interface');
  }
  if (node.type === 'TSEnumDeclaration' && node.loc) {
    addType(types, node.loc.start.line, node.id.name, '= enum');
  }

  // Class properties
  if (node.type === 'ClassProperty' || node.type === 'PropertyDefinition') {
    if (node.typeAnnotation && node.key.loc) {
      const type = extractType(node.typeAnnotation);
      addType(types, node.key.loc.start.line, node.key.name, type);
    }
  }

  // Recursively walk children
  for (const key in node) {
    if (key !== 'loc' && typeof node[key] === 'object' && node[key] !== null) {
      if (Array.isArray(node[key])) {
        node[key].forEach(child => walkAST(child, code, types, node));
      } else {
        walkAST(node[key], code, types, node);
      }
    }
  }
}

function extractType(typeAnnotation) {
  if (!typeAnnotation) return null;
  
  if (typeAnnotation.type === 'TSTypeAnnotation') {
    return extractTypeFromTypeNode(typeAnnotation.typeAnnotation);
  }
  
  return null;
}

function extractTypeFromTypeNode(node) {
  if (!node) return null;

  switch (node.type) {
    case 'TSStringKeyword':
      return 'string';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSNullKeyword':
      return 'null';
    case 'TSAnyKeyword':
      return 'any';
    case 'TSUnknownKeyword':
      return 'unknown';
    case 'TSObjectKeyword':
      return 'object';
    case 'TSTypeReference':
      return node.typeName.name || 'type';
    case 'TSArrayType':
      const itemType = extractTypeFromTypeNode(node.elementType);
      return itemType ? `${itemType}[]` : 'Array';
    case 'TSUnionType':
      const types = node.types.map(t => extractTypeFromTypeNode(t)).filter(Boolean);
      return types.length > 0 ? types.join(' | ') : 'union';
    case 'TSIntersectionType':
      const intersected = node.types.map(t => extractTypeFromTypeNode(t)).filter(Boolean);
      return intersected.length > 0 ? intersected.join(' & ') : 'intersection';
    case 'TSFunctionType':
      return 'function';
    case 'TSLiteralType':
      return `"${node.literal.value}"`;
    case 'TSGenericType':
    case 'TSTypeQuery':
      return 'type';
    default:
      return null;
  }
}

function inferValueType(node) {
  if (!node) return null;

  if (node.type === 'StringLiteral') return 'string';
  if (node.type === 'NumericLiteral') return 'number';
  if (node.type === 'BooleanLiteral') return 'boolean';
  if (node.type === 'NullLiteral') return 'null';
  if (node.type === 'ArrayExpression') return 'Array';
  if (node.type === 'ObjectExpression') return 'object';
  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return 'function';
  
  return null;
}

function addType(types, lineNum, symbol, type) {
  if (!types.has(lineNum)) {
    types.set(lineNum, []);
  }
  types.get(lineNum).push({ symbol, type });
}

/**
 * Detect potential type errors in TypeScript code
 */
export function detectTypeErrors(code) {
  const errors = [];

  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        ['decorators', { decoratorsBeforeExport: false }]
      ]
    });
  } catch (err) {
    if (err.loc) {
      errors.push({
        line: err.loc.line,
        column: err.loc.column,
        message: err.message.split('(')[0].trim()
      });
    }
  }

  return errors;
}
