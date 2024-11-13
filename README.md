# Income-Expense Tracker
# ระบบจัดการบัญชี รายรับ รายจ่าย

โปรเจคนี้เป็นเว็บแอปพลิเคชันที่ตอนนี้ยังมีแค่ฝั่ง Back-End เป็นโปรเจคที่ช่วยให้ผู้ใช้สามารถติดตามรายรับและรายจ่ายของตนเองได้ โดยผู้ใช้สามารถลงทะเบียนเข้าสู่ระบบและจัดการการเงินของตัวเอง เช่น การเพิ่มและลบบัญชี การจำแนกประเภทค่าใช้จ่าย และติดตามธุรกรรมทางการเงิน แอปพลิเคชันนี้ยังมีฟีเจอร์ที่ช่วยให้ผู้ใช้สามารถดูสรุปการใช้จ่ายและกรองข้อมูลตามเดือน ปี และประเภทต่างๆ รวมถึงการอัปโหลดสลิปธุรกรรม

## ฟีเจอร์หลัก:
- การลงทะเบียนและเข้าสู่ระบบ
- การเพิ่ม/ลบบัญชีและประเภทค่าใช้จ่าย
- สรุปการใช้จ่ายพร้อมตัวกรองต่างๆ
- ฟิลเตอร์ เดือน ปี ประเภท
- อัปโหลดสลิปธุรกรรม
- ฟิลเตอร์คำไม่สุภาพในบันทึกการทำธุรกรรม
- การจัดการเซสชันด้วยคุกกี้

## เทคโนโลยีที่ใช้:
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL
- **Authentication**: การจัดการเซสชันแบบกำหนดเอง (ไม่ใช้ JWT)

## สิ่งที่ทำเสร็จแล้ว:

### 1. การลงทะเบียนผู้ใช้ (`register`)
- ฟังก์ชันนี้จะทำการลงทะเบียนผู้ใช้ใหม่โดยการรับข้อมูลจากฟอร์ม เช่น ชื่อ-นามสกุล, อีเมล และรหัสผ่าน
- ตรวจสอบรูปแบบอีเมลและความยาวรหัสผ่าน
- เข้ารหัสรหัสผ่านด้วย `bcryptjs` ก่อนการเก็บลงฐานข้อมูล
- สร้าง session สำหรับผู้ใช้และตั้งค่า cookie สำหรับการเข้าสู่ระบบในครั้งถัดไป

### 2. การเข้าสู่ระบบ (`login`)
- ผู้ใช้จะต้องกรอกอีเมลและรหัสผ่าน
- ระบบจะตรวจสอบอีเมลและรหัสผ่านในฐานข้อมูล
- ถ้าผู้ใช้ถูกต้อง ระบบจะสร้าง session และตั้งค่า cookie สำหรับการเข้าสู่ระบบ

### 3. การสร้างบัญชีการเงิน (`createAccount`)
- ฟังก์ชันนี้จะสร้างบัญชีการเงินใหม่ให้ผู้ใช้โดยรับชื่อบัญชีและยอดเงิน
- ระบบจะตรวจสอบข้อมูลและตรวจสอบสิทธิ์ของผู้ใช้ด้วย session ที่มีอยู่
- ข้อมูลบัญชีจะถูกบันทึกลงในฐานข้อมูลของผู้ใช้

### 4. การลบบัญชีการเงิน (`deleteAccount`)
- ฟังก์ชันนี้จะทำการลบบัญชีการเงินที่เลือก โดยผู้ใช้จะต้องยืนยันการเป็นเจ้าของบัญชี
- ระบบจะตรวจสอบ session และตรวจสอบว่าเป็นบัญชีของผู้ใช้จริงก่อนที่จะทำการลบ

### 5. การทำรายการการเงิน (`createTransaction`)
- ฟังก์ชันนี้ใช้สำหรับการทำรายการการเงิน โดยสามารถทำการเพิ่มรายได้ (income) หรือหักรายจ่าย (expense)
- มีตรวจสอบประเภทของธุรกรรมและตรวจสอบยอดเงินในบัญชี
- ฟังก์ชันนี้ยังรองรับการอัปโหลดใบเสร็จ (transaction slip) และการกรองคำหยาบในคำอธิบาย
- ฟังก์ชันจะทำการอัปเดตยอดเงินในบัญชีตามประเภทธุรกรรม และบันทึกข้อมูลธุรกรรมในฐานข้อมูล
- มีการตรวจสอบความถูกต้องของข้อมูลที่ส่งมา เช่น จำนวนเงินที่เป็นบวกและไม่เกินยอดเงินในบัญชี

### 6. การสรุปยอดใช้จ่าย (`summary`)
- ฟังก์ชันนี้ช้สำหรับดึงข้อมูลสรุปยอดใช้จ่ายจากฐานข้อมูล โดยสามารถกรองข้อมูลได้ตามช่วงเวลา ประเภทของธุรกรรม และบัญชีการเงินที่เกี่ยวข้อง ฟังก์ชันนี้ช่วยให้ผู้ใช้สามารถดูยอดรวมของรายได้และรายจ่ายในช่วงเวลาที่กำหนดได้อย่างรวดเร็ว
- ตรวจสอบข้อมูลที่ถูกส่งเข้ามา ซึ่งต้องเป็นไปตามรูปแบบที่ถูกต้อง
- ตรวจสอบการเข้าสู่ระบบโดยใช้ `sessionId` จาก cookies
- ดึงข้อมูลสรุปยอดจากฐานข้อมูลที่เกี่ยวข้องกับผู้ใช้ เช่น ยอดรวมของธุรกรรมแต่ละประเภท (รายได้หรือรายจ่าย) ตามเงื่อนไขที่กำหนด
- ถ้ามีข้อมูลที่ตรงกับเงื่อนไขที่ระบุ ฟังก์ชันจะส่งสรุปยอดกลับไปยังผู้ใช้ ในรูปแบบ JSON

### 6. Export ข้อมูลธุรกรรม (`exportSummary`)
- ฟังก์ชันนี้ช่วยให้ผู้ใช้สามารถส่งออกข้อมูลธุรกรรมในรูปแบบต่างๆ ได้แก่ CSV, Excel, และ JSON โดยสามารถกรองข้อมูลธุรกรรมได้ตามวันที่ ช่วงเวลาที่กำหนด
- ฟังก์ชันจะตรวจสอบการเข้าสู่ระบบโดยใช้ `sessionId` จาก cookies
- ฟังก์ชันจะดึงข้อมูลธุรกรรมจากฐานข้อมูล โดยสามารถกรองข้อมูลได้ตามช่วงเวลา และ และบัญชีการเงิน
- ฟังก์ชันรองรับการส่งออกข้อมูลใน 3 รูปแบบ CSV, Excel, และ JSON

### 6. filter ธุรกรรม (`filterTransactions`)
- ใช้ฟิลเตอร์ข้อมูลธุรกรรมตามเกณฑ์ต่างๆ เช่น รหัสบัญชี ประเภทธุรกรรม ช่วงวันที่ และตัวเลือกการแบ่งหน้า

## ตัว Code จะมีการสร้าง Database และ Tables เองอัติโนมัติ

## การทดสอบ API


สำหรับ Register 
- **POST /api/auth/register**: 
  - Request body: 
      ```json
      {
        "fname": "John",
        "lname": "Doe",
        "email": "john1@gmail.com",
        "password": "123456789a"
      }
      ```
    - Response body:
    ```json
    {
        "message": "User registered successfully",
        "user": {
            "id": 1,
            "fname": "John",
            "lname": "Doe",
            "email": "john1@gmail.com",
            "password": "$2a$10$8XVRo0EUnomnwmx1seyga.x/GFzWNcebP7YAJpsK7m0o0JZ8/yyBa"
        }
    }       
    ``` 

สำหรับ Login
- **POST /api/auth/Login**: 
  - Request body: 
      ```json
      {
        "email": "john1@gmail.com",
        "password": "123456789a"
      }
      ```
    - Response body:
    ```json
      {
        "message": "Login successful"
      }
    ``` 

สำหรับ Logout
- **POST /api/auth/logout**: 
  - Request body: 
      ```json
      {
        "email": "john1@gmail.com",
        "password": "123456789a"
      }
      ```
    - Response body:
    ```json
      {
        "message": "Logout successful"
      }
    ``` 


สำหรับ สร้างบัญชีสำหรับทำธุรกรรม
- **POST /api/accounts/create**: 
  - Request body: 
      ```json
      {
        "accountName": "My main account",
        "balance": 200
      }
      ```
    - Response body:
    ```json
      {
        "message": "Account created successfully",
        "account": {
            "account_id": 1,
            "user_id": 1,
            "account_name": "My main account",
            "balance": "200.00"
        }
      }
    ``` 


สำหรับ ทำธุรกรรม
- **POST /api/transactions/addTransaction**: 
  - Request body: 
      ```json
        {
            "accountId": 1,
            "transaction_type": "income",
            "amount": "500",
            "description": "Dad gives me"
        }
      ```
        or form-data เพื่อ ส่งรูปภาพไปด้วย

    - Response body:
    ```json
        { 
        "message": "Transaction successful",
        "newBalance": 700
        }
    ``` 


สำหรับ filter ปี เดือน วัน 
- **GET /api/transactions/filterTransactions?accountId=1&type=income&startDate=2024-1-1&endDate=2024-12-12&page=1&limit=20 **: 
  - Request Params: 
      ```Query Params
        {
            account : 1,
            type: income,
            startDate: 2024-1-1,
            endDate: 2024-12-12,
            page: 1, 
            limit: 20
        }
      ```
    - Response body:
    ```json
        {
            "transactions": [
                {
                    "transaction_id": 1,
                    "user_id": 1,
                    "account_id": 1,
                    "amount": "500.00",
                    "transaction_date": "2024-11-13T08:40:59.863Z",
                    "transaction_type": "income",
                    "description": "Dad gives me",
                    "transaction_slip": null,
                    "account_name": "My main account",
                    "balance": "700.00"
                }
        ],
        "page": 1,
        "limit": 20
         }


สำหรับ สรุปยอดรวม
- **GET /api/summary/getSummary/?startDate=2024-01-01&endDate=2024-12-12&accountId=1&transactionType=income **: 
  - Request Params: 
      ```Query Params
        {
            startDate: 2024-1-1,
            endDate: 2024-12-12,
            accountId: 1,
            transactionType: income
        }
      ```
    - Response body:
    ```json
        {
        "message": "Transaction summary retrieved successfully",
        "summary": 
        [
            {
                "transactionType": "income",
                "totalAmount": "500.00"
            }
             ]
        }   



สำหรับ export สรุปออกเป็นไฟล์ csv, json or excel ตามเราเลือก
- **GET /api/summary/export/?startDate=2024-01-01&endDate=2024-11-14&accountId=1&format=csv **: 
  - Request Params: 
      ```Query Params
        {
            startDate: 2024-1-1,
            endDate: 2024-11-14,
            accountId: 1,
            format: csv
        }
      ```
    - Response body:
    ```csv
        "transactionType","amount","transactionDate","description"
        "income","500.00","2024-11-13T08:40:59.863Z","Dad gives me"
    ```



สำหรับ ลบบัญชีธุรกกรม
- **DELETE /api/accounts/delete/1 **: 
  -  none

      ```
    - Response body:
    ```json
        {
            "message": "Account deleted successfully"
        }
