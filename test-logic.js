// 第二阶段逻辑层测试（不依赖浏览器）
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'public', 'LogicParser.js'), 'utf8');
// LogicParser.js 仅含纯 JS 函数，可直接求值
eval(src);

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  PASS', name); }
    else { fail++; console.log('  FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); }
}

function truthFor(expr) {
    const p = NpnValidate(expr);
    if (!p.ok) return { error: p.error };
    const tt = NpnTruthTable(expr, p);
    if (tt.error) return { error: tt.error };
    return tt;
}

console.log('== 校验与错误提示 ==');
check('空输入报错', NpnValidate('').ok === false);
check('a . 操作数不足', !NpnValidate('a .').ok && NpnValidate('a .').error.indexOf('操作数不足') >= 0);
check('a b 多余操作数', !NpnValidate('a b').ok && NpnValidate('a b').error.indexOf('多余') >= 0);
check('a < 合法', NpnValidate('a <').ok === true);

console.log('== 五种运算真值表 ==');

// AND
let t = truthFor('a b .');
check('AND 变量数=2', t.variables && t.variables.length === 2);
check('AND 行数=4', t.rows.length === 4);
check('AND 仅 1,1 为 1', t.rows.filter(r => r.result === 1).length === 1
    && t.rows.find(r => r.values[0] === 1 && r.values[1] === 1).result === 1);
check('AND 可满足但非永真', t.classification.indexOf('可满足') >= 0);

// OR
t = truthFor('a b ,');
check('OR 仅 0,0 为 0', t.rows.filter(r => r.result === 0).length === 1
    && t.rows.find(r => r.values[0] === 0 && r.values[1] === 0).result === 0);

// NOT
t = truthFor('a <');
check('NOT 变量数=1 行数=2', t.variables.length === 1 && t.rows.length === 2);
check('NOT a=0 -> 1, a=1 -> 0',
    t.rows.find(r => r.values[0] === 0).result === 1 && t.rows.find(r => r.values[0] === 1).result === 0);

// IMPLY
t = truthFor('a b >');
check('IMPLY 仅 a=1,b=0 为 0', t.rows.filter(r => r.result === 0).length === 1
    && t.rows.find(r => r.values[0] === 1 && r.values[1] === 0).result === 0);

// XNOR
t = truthFor('a b =');
check('XNOR 相同为 1 不同为 0',
    t.rows.find(r => r.values[0] === 0 && r.values[1] === 0).result === 1
    && t.rows.find(r => r.values[0] === 1 && r.values[1] === 1).result === 1
    && t.rows.find(r => r.values[0] === 1 && r.values[1] === 0).result === 0);

console.log('== 指定用例 ==');
t = truthFor('a a < ,');
check('a a < , 恒为真(永真式)', t.classification.indexOf('永真') >= 0 && t.rows.every(r => r.result === 1));

t = truthFor('a a < .');
check('a a < . 恒为假(矛盾式)', t.classification.indexOf('矛盾') >= 0 && t.rows.every(r => r.result === 0));

t = truthFor('a b >');
check('a b > 仅 a=1,b=0 为假', t.rows.filter(r => r.result === 0).length === 1
    && t.rows.find(r => r.values[0] === 1 && r.values[1] === 0).result === 0);

console.log('== 重复变量一致性 ==');
// 变量重复出现时取同一值：a a . 等价于 a
t = truthFor('a a .');
check('a a . 变量去重为 1 个', t.variables.length === 1);
check('a a . 与 a 同真值', t.rows[0].result === 0 && t.rows[1].result === 1);

console.log('== 变量上限 ==');
const many = 'a b c d e f g h i . . . . . . . .';
const pm = NpnValidate(many);
check('9 个变量校验合法', pm.ok === true && pm.variables.length === 9);
const ttm = NpnTruthTable(many, pm);
check('9 个变量真值表报错', ttm.error && ttm.error.indexOf('8') >= 0);

console.log('== 图形生成（ViewGen/ModelGen）==');
function graphFor(expr) {
    const p = NpnValidate(expr);
    if (!p.ok) return { error: p.error };
    const tree = NpnBuildTree(p.tokens);
    return ViewGen(ModelGen(tree));
}
for (const e of ['a b .', 'a b ,', 'a <', 'a b >', 'a b =', 'a a < ,', 'a a < .', 'a', '0', '1']) {
    const g = graphFor(e);
    check('图形生成 ' + e, g && Array.isArray(g.nodeArray) && Array.isArray(g.linkArray) && g.nodeArray.length > 0);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);
