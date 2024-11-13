const { Pool } = require('pg');
require('dotenv').config();

// สร้าง pool สำหรับเชื่อมต่อกับฐานข้อมูล
const pool = new Pool({
    user: process.env.PG_USER, 
    host: process.env.PG_HOST, 
    database: process.env.PG_DATABASE, 
    password: process.env.PG_PASSWORD, 
    port: process.env.PG_PORT,
});

// ฟังก์ชันสร้างตารางในฐานข้อมูล
const createTables = async () => {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS public.users (
            id SERIAL PRIMARY KEY,
            fname character varying(100) COLLATE pg_catalog."default",
            lname character varying(100) COLLATE pg_catalog."default",
            email character varying(150) COLLATE pg_catalog."default",
            password character varying(255) COLLATE pg_catalog."default",
            CONSTRAINT users_email_key UNIQUE (email)
        );
    `;

    const createAccountsTable = `
        CREATE TABLE IF NOT EXISTS public.accounts (
            account_id SERIAL PRIMARY KEY,  
            user_id integer,
            account_name character varying(100) COLLATE pg_catalog."default",
            balance numeric(10,2) DEFAULT 0,
            CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id)
                REFERENCES public.users (id) MATCH SIMPLE
                ON UPDATE NO ACTION
                ON DELETE NO ACTION
        );
    `;


    const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS public.sessions (
            session_id character varying(255) COLLATE pg_catalog."default" NOT NULL,
            user_id integer NOT NULL,
            created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT sessions_pkey PRIMARY KEY (session_id)
        );
    `;

   const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS public.transactions (
            transaction_id SERIAL PRIMARY KEY,  
            user_id integer,
            account_id integer,
            amount numeric(10,2) NOT NULL,
            transaction_date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            transaction_type character varying(50) COLLATE pg_catalog."default",
            description text COLLATE pg_catalog."default",
            transaction_slip character varying(255) COLLATE pg_catalog."default",
            CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id)
                REFERENCES public.users (id) MATCH SIMPLE
                ON UPDATE NO ACTION
                ON DELETE CASCADE,
            CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id)
                REFERENCES public.accounts (account_id) MATCH SIMPLE
                ON UPDATE NO ACTION
                ON DELETE CASCADE
        );
    `;



    try {
        // สร้างตารางทั้งหมด
        await pool.query(createUsersTable);
        await pool.query(createAccountsTable);
        await pool.query(createSessionsTable);
        await pool.query(createTransactionsTable);
        console.log('Tables "users", "accounts", "sessions" and "transactions" created or already exist');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

// เชื่อมต่อฐานข้อมูลและสร้างตาราง
const connectAndCreateTables = async () => {
    try {
        await pool.connect();
        console.log('Connected to the database');
        await createTables();
    } catch (err) {
        console.error('Error connecting to the database', err);
    }
};


connectAndCreateTables();

module.exports = { pool };