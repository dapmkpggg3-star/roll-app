'use strict';
const { validDate } = require('./preparation-forecast');
function compareEventOrder(before, after) {
    const valid = event => event && validDate(event.earliest) && validDate(event.latest) && event.earliest <= event.latest;
    if (!valid(before) || !valid(after)) return { state: 'unknown', reason: '日付範囲が未確認または不正' };
    if (after.latest < before.earliest) return { state: 'conflict', reason: '後工程の日付が前工程より前' };
    if (after.earliest < before.latest) return { state: 'unknown', reason: '日付範囲が重なり順序未確定' };
    return { state: 'ordered', reason: '日単位の前後関係のみ整合。準備完了は未判定' };
}
module.exports = { compareEventOrder };
