// A simple list of obscene words (extend this list as needed)
   const obsceneWords = [
    "ควย", "เหี้ย", "สัส", "ห่า", "เชี่ย", "มึง", "กู", "เย็ด", "หี", 
    "ไอ้สัตว์", "ไอ้สัส", "ไอ้เหี้ย", "ไอ้ควาย", "ไอ้ฟาย", "แม่มึงตาย", 
    "พ่อมึงตาย", "ส้นตีน", "ตีน"
]

function filterObsceneWords(text) {
    return obsceneWords.reduce((filteredText, word) => {
        const regex = new RegExp(word, 'gi');
        return filteredText.replace(regex, '***');
    }, text);
}

module.exports = { filterObsceneWords };