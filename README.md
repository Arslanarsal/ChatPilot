<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

### **Chat Pilot Server**

-----

### **Project Title**

**WhatsApp Chat Pilot**

### **Project Description**

The WhatsApp Chat Pilot is a specialized chat management system designed for businesses to streamline their communication and automate tasks on WhatsApp. The system consists of two separate servers: a **Chat Pilot** server and a dedicated **Bot Server**. This repository focuses on the **Chat Pilot** server, which serves as the core registration and management platform for companies.

The Chat Pilot allows companies to register and manage their communication flows. Once a company is registered, the system assigns a dedicated bot to them. These bots are capable of performing various tasks, including:

  * **Scheduling meetings:** Handling appointment setting directly within WhatsApp chats.
  * **Providing automated responses:** Offering intelligent, human-like replies based on previous chat history, even during off-hours.
  * **Guiding users:** Leading customers through end-to-end deals or assisting patients with suggestions based on their past conversations.

The bot's replies are simple, readable, and designed to provide a seamless, human-like experience. This entire system aims to provide an efficient and scalable solution for business-to-customer communication on the WhatsApp platform.

### **Core Technologies**

The Chat Pilot server is built with the following technologies:

  * **Backend:** [NestJS](https://nestjs.com/)
  * **Database:** [PostgreSQL](https://www.postgresql.org/)
  * **ORM:** [Prisma](https://www.prisma.io/)
  * **API Documentation:** [Swagger](https://swagger.io/)
  * **Cloud Services:** [Supabase](https://supabase.com/)

### **Prerequisites**

Before you begin, ensure you have the following installed on your system:

  * [Node.js](https://nodejs.org/) (version 18 or later is recommended)
  * [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
  * [PostgreSQL](https://www.postgresql.org/download/)

### **Getting Started**

Follow these steps to get the project up and running on your local machine.

#### 1\. Clone the Repository

```bash
git clone <your-repository-url>
cd <your-repository-folder>
```

#### 2\. Install Dependencies

```bash
npm install
# or
yarn install
```

#### 3\. Set Up the Database

1.  Ensure you have a PostgreSQL server running.
2.  Create a new, empty database for the project (e.g., `chat_pilot`).

#### 4\. Configure Environment Variables

Create a `.env` file in the root directory of the project and add your database connection details:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/chat_pilot?schema=public"
# Replace with your actual database credentials and host.

PORT=3000
# Add any other API keys or secrets here
```

#### 5\. Run Prisma Migrations

With your database configured, apply the database schema using Prisma:

```bash
npx prisma migrate dev --name init
```

This command will create the tables and relationships defined in your `prisma/schema.prisma` file.

#### 6\. Run the Application

Now you can start the NestJS server:

```bash
npm run start:dev
# or
yarn start:dev
```

The server will be available at `http://localhost:3000`.

### **API Documentation**

The project uses **Swagger** for API documentation. You can access the live documentation at:

`http://localhost:3000/api`

This page provides a clear overview of all available endpoints, their request/response schemas, and allows you to test them directly from your browser.

### **Author**

This project was created and is maintained by **M. Arslan**.

  * **LinkedIn:** [linkedin.com/in/m-arslan-aa21a0246](https://www.linkedin.com/in/m-arslan-aa21a0246/)
  * **GitHub:** [github.com/Arslanarsal](https://github.com/Arslanarsal)
  * **LeetCode:** [leetcode.com/u/arslanarsal](https://leetcode.com/u/arslanarsal/)

