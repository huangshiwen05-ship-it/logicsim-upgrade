function LogicParser(npn) {
    var andM = function (a, b) {
        return {
            "S": a,
            "0": "0",
            "1": {
                "S": b,
                "0": "0",
                "1": "1"
            }
        }
    };
    var orM = function (a, b) {
        return {
            "S": a,
            "0": {
                "S": b,
                "0": "0",
                "1": "1"
            },
            "1": "1"
        }
    };
    var notM = function (a) {
        return {
            "S": a,
            "0": "1",
            "1": "0"
        }
    };
    var infM = function (a, b) {
        return {
            "S": a,
            "0": "1",
            "1": {
                "S": b,
                "0": "0",
                "1": "1"
            }
        }
    };
    var equalM = function (a, b) {
        return {
            "S": a,
            "0": {
                "S": b,
                "0": "1",
                "1": "0"
            },
            "1": {
                "S": b,
                "0": "0",
                "1": "1"
            }
        }
    };
    var state = 0;
    var nstate = 0;
    /* state is
       0: tic
       1: toc
       we parse:
       ".": "and",
       ",": "or",
       ">": "infer",
       "<": "not"
       "=": "equal"
     */
    if ("" == npn) { return "Empty String!" };
    for (var e = [], s = npn.split(/(\.|,|<|>|=|\s)/), t = 0;
        t < s.length; t++) {
        var n = s[t];
        if ("" == n) { }
        else if (n.match(/\s/)) {
            if (1 == state) { state = 0; nstate++; }
        }
        else if (n.match(/\./)) {
            var temp1 = e.pop();
            var temp2 = e.pop();
            if (1 == state) {
                return "use wrong Name as variable"
            }
            else if (undefined == temp1 || undefined == temp2) {
                return "Format Error: arguments less than needed"
            }
            else {
                e.push(andM(temp2, temp1));
                nstate--;
            }
        }
        else if (n.match(/,/)) {
            var temp1 = e.pop();
            var temp2 = e.pop();
            if (1 == state) {
                return "use wrong Name as variable"
            }
            else if (undefined == temp1 || undefined == temp2) {
                return "Format Error: arguments less than needed"
            }
            else {
                e.push(orM(temp2, temp1));
                nstate--;
            }
        }
        else if (n.match(/</)) {
            var temp1 = e.pop();
            if (1 == state) {
                return "use wrong Name as variable"
            }
            else if (undefined == temp1) {
                return "Format Error: arguments less than needed"
            }
            else {
                e.push(notM(temp1));
            }
        }
        else if (n.match(/>/)) {
            var temp1 = e.pop();
            var temp2 = e.pop();
            if (1 == state) {
                return "use wrong Name as variable"
            }
            else if (undefined == temp1 || undefined == temp2) {
                return "Format Error: arguments less than needed"
            }
            else {
                e.push(infM(temp2, temp1));
                nstate--;
            }
        }
        else if (n.match(/=/)) {
            var temp1 = e.pop();
            var temp2 = e.pop();
            if (1 == state) {
                return "use wrong Name as variable"
            }
            else if (undefined == temp1 || undefined == temp2) {
                return "Format Error: arguments less than needed"
            }
            else {
                e.push(equalM(temp2, temp1));
                nstate--;
            }
        }
        else {
            if (0 == state) {
                state = 1;
                e.push(n);
            }

        }

    };
    if (nstate > 1) { return "Format Error: arguments more than needed" };
    return e.pop();
};

function ModelGen(np) {
    /* 0:"<"
       1:">" */
    var result = {
        value: [],
        order: []
    };
    if ("string" == typeof (np)) {
        if ("1" == np) {
            result.value = [{ ".": ">" }];
            result.order = [];
        } else if ("0" == np) {
            result.value = [{ ".": "<" }];
            result.order = [];
        } else {
            var temp1 = { ".": ">" };
            var temp2 = { ".": "<" };
            temp1[np] = ">";
            temp2[np] = "<";
            result.value = [temp1, temp2];
            result.order = [np];
        }

    }
    else {
        var result1 = ModelGen(np.S);

        if (0 == result1.order.length) {
            if ("<" == result1.value[0]["."]) {
                result = ModelGen(np[0]);
            } else {
                result = ModelGen(np[1]);
            }
        }
        else {
            var myset = new Set(result1.order);

            var result2 = ModelGen(np[0]);
            var intersection2 = result2.order.filter(x => myset.has(x));

            var result3 = ModelGen(np[1]);
            var intersection3 = result3.order.filter(x => myset.has(x));

            var all0 = false;
            var all1 = false;

            for (let x of result1.value) {
                if ("<" == x["."]) {
                    for (let y of result2.value) {
                        var YesOrNot = true;
                        for (let z of intersection2) {
                            if (undefined != x[z] && undefined != y[z] && x[z] != y[z]) {
                                YesOrNot = false;
                                break;
                            }
                        };
                        if (YesOrNot) {
                            var newValue = {};
                            for (var k in x) {
                                var item = x[k];
                                newValue[k] = item;
                            }
                            for (let alpha of result2.order) {
                                if (undefined != y[alpha]) {
                                    newValue[alpha] = y[alpha];
                                }
                            };
                            newValue["."] = y["."];
                            if (">" == newValue["."]) {
                                all1 = true;
                            } else {
                                all0 = true;
                            };
                            result.value.push(newValue);
                        }
                    }
                }
                else {
                    for (let y of result3.value) {
                        var YesOrNot = true;
                        for (let z of intersection3) {
                            if (undefined != x[z] && undefined != y[z] && x[z] != y[z]) {
                                YesOrNot = false;
                                break;
                            }
                        };
                        if (YesOrNot) {
                            var newValue = {};
                            for (var k in x) {
                                var item = x[k];
                                newValue[k] = item;
                            }
                            for (let alpha of result3.order) {
                                if (undefined != y[alpha]) {
                                    newValue[alpha] = y[alpha];
                                }
                            };
                            newValue["."] = y["."];
                            if (">" == newValue["."]) {
                                all1 = true;
                            } else {
                                all0 = true;
                            };
                            result.value.push(newValue);
                        }
                    }
                }
            };
            if (all0 && !all1) {
                result = {
                    value: [{ ".": "<" }],
                    order: []
                }
            } else if (all1 && !all0) {
                result = {
                    value: [{ ".": ">" }],
                    order: []
                }
            }
            else {
                var tempOrder = new Set(
                    result1.order.concat(result2.order).concat(result3.order)
                );
                result.order = Array.from(tempOrder);
            }
        }
    }
    return result;
}

function ViewGen(pn) {
    var countKey = 2;
    var result = {
        nodeArray: [
            { "key": "0", "type": "0", "name": "Zero" },
            { "key": 1, "type": "1", "name": "One" },
            { "key": 2, "type": "Export", "name": "Out" }
        ],
        linkArray: []
    }
    function ViewGen0(pnp, NodeKey, PortId) {
        if (1 == pnp.value.length) {
            if ("<" == pnp.value[0]["."]) {
                return {
                    nodeArray: [],
                    linkArray: [{ "from": "0", "frompid": "OUT", "to": NodeKey, "topid": PortId }]
                };
            } else {
                return {
                    nodeArray: [],
                    linkArray: [{ "from": 1, "frompid": "OUT", "to": NodeKey, "topid": PortId }]
                };
            }
        }
        else {
            var CName = "";
            for (CName0 of pnp.order) {
                if (pnp.value.length == pnp.value.filter(function (x) { return undefined != x[CName0] }).length) {
                    CName = CName0;
                }
            }

            if ("" != CName) {
                var TempOrder = pnp.order.filter(function(x){
                    return x  != CName
                });

                var pnp1 = {
                    value: pnp.value.filter(function (x) { return "<" == x[CName] }),
                    order: TempOrder
                };
                var pnp2 = {
                    value: pnp.value.filter(function (x) { return ">" == x[CName] }),
                    order: TempOrder
                };

                countKey++;
                var NodeKeyNow = countKey;
                var NodeLink1 = ViewGen0(pnp1, NodeKeyNow, "0");
                var NodeLink2 = ViewGen0(pnp2, NodeKeyNow, "1");

                return {
                    nodeArray: [{ "key": NodeKeyNow, "type": "SEL" }].concat(NodeLink1.nodeArray, NodeLink2.nodeArray),
                    linkArray: [{ "from": NodeKeyNow, "frompid": "N", "to": NodeKey, "topid": PortId },
                    { "from": CName, "frompid": "OUT", "to": NodeKeyNow, "topid": "SI" }].concat(NodeLink1.linkArray, NodeLink2.linkArray)
                };
            }
        }
    };
    for (x of pn.order) {
        result.nodeArray = result.nodeArray.concat({ "key": x, "type": "Import", "name": x })
    }
    var temp = ViewGen0(pn, countKey, "OUT");
    result.nodeArray = result.nodeArray.concat(temp.nodeArray);
    result.linkArray = result.linkArray.concat(temp.linkArray);
    return result;
}

/* ============================================================
 * 第二阶段新增：独立求值器、校验器与真值表
 * 说明：不与 ModelGen 的分支路径混用，单独枚举全部 0/1 组合。
 * ============================================================ */

// 与 LogicParser 内部一致的操作符节点模板（用于独立构建决策树）
function NpnAnd(a, b) { return { "S": a, "0": "0", "1": { "S": b, "0": "0", "1": "1" } }; }
function NpnOr(a, b) { return { "S": a, "0": { "S": b, "0": "0", "1": "1" }, "1": "1" }; }
function NpnNot(a) { return { "S": a, "0": "1", "1": "0" }; }
function NpnInf(a, b) { return { "S": a, "0": "1", "1": { "S": b, "0": "0", "1": "1" } }; }
function NpnEqual(a, b) { return { "S": a, "0": { "S": b, "0": "1", "1": "0" }, "1": { "S": b, "0": "0", "1": "1" } }; }

var NpnOperators = { ".": true, ",": true, "<": true, ">": true, "=": true };

var NpnOpName = { ".": "与(AND)", ",": "或(OR)", "<": "非(NOT)", ">": "推出(IMPLY)", "=": "等价(XNOR)" };

// 分词：返回 [{text, index}]，index 为字符位置（0 基）
function NpnTokenize(npn) {
    var tokens = [];
    var i = 0;
    var n = npn.length;
    while (i < n) {
        var ch = npn.charAt(i);
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
            i++;
            continue;
        }
        if (NpnOperators[ch]) {
            tokens.push({ text: ch, index: i });
            i++;
            continue;
        }
        var start = i;
        while (i < n) {
            var c = npn.charAt(i);
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || NpnOperators[c]) {
                break;
            }
            i++;
        }
        tokens.push({ text: npn.slice(start, i), index: start });
    }
    return tokens;
}

// 校验并提取变量。返回 {ok:true, tokens, variables} 或 {ok:false, error}
function NpnValidate(npn) {
    var tokenObjs = NpnTokenize(npn);
    if (tokenObjs.length === 0) {
        return { ok: false, error: "输入为空：请在表达式框内输入逆波兰逻辑表达式。" };
    }
    var stack = [];
    for (var k = 0; k < tokenObjs.length; k++) {
        var tok = tokenObjs[k];
        var t = tok.text;
        if (t === "<") {
            if (stack.length < 1) {
                return { ok: false, error: "操作数不足：'<'（逻辑非）需要一个操作数，出错位置在第 " + (tok.index + 1) + " 个字符附近。" };
            }
            stack.pop();
            stack.push(k);
        } else if (t === "." || t === "," || t === ">" || t === "=") {
            if (stack.length < 2) {
                return { ok: false, error: "操作数不足：'" + t + "'（" + NpnOpName[t] + "）需要两个操作数，出错位置在第 " + (tok.index + 1) + " 个字符附近。" };
            }
            stack.pop();
            stack.pop();
            stack.push(k);
        } else {
            stack.push(k);
        }
    }
    if (stack.length === 0) {
        return { ok: false, error: "表达式无效。" };
    }
    if (stack.length > 1) {
        var first = tokenObjs[stack[0]];
        return { ok: false, error: "多余操作数：表达式解析后仍剩余 " + (stack.length - 1) + " 个操作数，出错位置在第 " + (first.index + 1) + " 个字符附近（'" + first.text + "'）。" };
    }

    var variables = [];
    var seen = {};
    var tokens = [];
    for (var j = 0; j < tokenObjs.length; j++) {
        var tx = tokenObjs[j].text;
        tokens.push(tx);
        if (!NpnOperators[tx] && !seen[tx]) {
            seen[tx] = true;
            variables.push(tx);
        }
    }
    return { ok: true, tokens: tokens, variables: variables, positions: tokenObjs };
}

// 独立求值：assignment 为 {变量名: 0/1}
function NpnEvaluate(tokens, assignment) {
    var stack = [];
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t === ".") {
            var b = stack.pop() ? 1 : 0;
            var a = stack.pop() ? 1 : 0;
            stack.push((a && b) ? 1 : 0);
        } else if (t === ",") {
            var b = stack.pop() ? 1 : 0;
            var a = stack.pop() ? 1 : 0;
            stack.push((a || b) ? 1 : 0);
        } else if (t === "<") {
            var a = stack.pop() ? 1 : 0;
            stack.push(a ? 0 : 1);
        } else if (t === ">") {
            var b = stack.pop() ? 1 : 0;
            var a = stack.pop() ? 1 : 0;
            stack.push((!a || b) ? 1 : 0);
        } else if (t === "=") {
            var b = stack.pop() ? 1 : 0;
            var a = stack.pop() ? 1 : 0;
            stack.push((a === b) ? 1 : 0);
        } else {
            stack.push(assignment[t] ? 1 : 0);
        }
    }
    return stack.pop() ? 1 : 0;
}

// 真值表：枚举全部 0/1 组合，最多 8 个变量
function NpnTruthTable(npn, parsed) {
    var variables = parsed.variables;
    if (variables.length > 8) {
        return { error: "变量过多：真值表最多支持 8 个不同变量，当前表达式有 " + variables.length + " 个变量，暂不生成真值表。" };
    }
    var rows = [];
    var all1 = true;
    var all0 = true;
    var comboCount = Math.pow(2, variables.length);
    for (var c = 0; c < comboCount; c++) {
        var assign = {};
        var values = [];
        for (var v = 0; v < variables.length; v++) {
            var bit = (c >> (variables.length - 1 - v)) & 1;
            assign[variables[v]] = bit;
            values.push(bit);
        }
        var result = NpnEvaluate(parsed.tokens, assign);
        rows.push({ values: values, result: result });
        if (result === 1) { all0 = false; } else { all1 = false; }
    }
    var classification;
    if (all1) { classification = "永真式（重言式）"; }
    else if (all0) { classification = "矛盾式"; }
    else { classification = "可满足但非永真"; }
    return { variables: variables, rows: rows, classification: classification };
}

// 独立构建决策树（供 ModelGen/ViewGen 使用），结果与 LogicParser 一致
function NpnBuildTree(tokens) {
    var stack = [];
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t === ".") {
            var b = stack.pop();
            var a = stack.pop();
            stack.push(NpnAnd(a, b));
        } else if (t === ",") {
            var b = stack.pop();
            var a = stack.pop();
            stack.push(NpnOr(a, b));
        } else if (t === "<") {
            var a = stack.pop();
            stack.push(NpnNot(a));
        } else if (t === ">") {
            var b = stack.pop();
            var a = stack.pop();
            stack.push(NpnInf(a, b));
        } else if (t === "=") {
            var b = stack.pop();
            var a = stack.pop();
            stack.push(NpnEqual(a, b));
        } else {
            stack.push(t);
        }
    }
    return stack.pop();
}