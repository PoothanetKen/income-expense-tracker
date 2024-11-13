//ใส่ คำพวกนี้ ใน description เพื่อดูผลลัพธ์
const badWords = [
    "badword1", "badword2", "fuck"
];

//กรองคำหยาบ
function filterBadWords(text) {
    return badWords.reduce((filteredText, word) => {
        const regex = new RegExp(word, 'gi');
        return filteredText.replace(regex, '***');
    }, text);
}

module.exports = { filterBadWords };