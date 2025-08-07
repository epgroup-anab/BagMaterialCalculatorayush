# Smart Bag Material Calculator

## Overview

A professional web application that calculates raw material requirements for bag manufacturing based on bag specifications. The system automatically generates accurate Bill of Materials (BOM) with SAP codes, handles various paper grades and handle types, and provides comprehensive material calculations for manufacturing processes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and hot reloading
- **UI Components**: shadcn/ui component library built on Radix UI primitives for consistent, accessible interface
- **Styling**: Tailwind CSS with custom CSS variables for theming and responsive design
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon serverless database
- **Build System**: esbuild for fast production builds
- **Development**: tsx for TypeScript execution in development

### Data Storage
- **Primary Database**: PostgreSQL via Neon Database serverless platform
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Connection**: @neondatabase/serverless for optimized serverless database connections
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple

### Authentication & Session Management
- **Session Store**: PostgreSQL-based session storage
- **User Schema**: Basic user table with username/password fields and UUID primary keys
- **Validation**: Zod schemas for input validation and type safety

### Material Calculation Engine
- **Material Database**: Comprehensive database of paper grades (Virgin, Recycled, Fibreform) with GSM specifications
- **SAP Integration**: Material codes mapped to SAP system codes for enterprise integration
- **Calculation Logic**: Automatic calculation of paper requirements, handle materials, adhesives, and patches based on bag dimensions
- **BOM Generation**: Complete Bill of Materials generation with quantities and material codes

### Key Design Decisions

**Monorepo Structure**: Organized into `client/`, `server/`, and `shared/` directories for clear separation of concerns while enabling code sharing between frontend and backend.

**Type Safety**: End-to-end TypeScript implementation with shared schemas between client and server, ensuring data consistency and reducing runtime errors.

**Component System**: shadcn/ui provides a professional, accessible component library that can be customized while maintaining design consistency.

**Database Choice**: PostgreSQL chosen for its reliability, ACID compliance, and excellent support for complex queries needed for material calculations.

**Serverless Database**: Neon Database provides PostgreSQL compatibility with serverless benefits like automatic scaling and reduced cold starts.

**State Management Strategy**: TanStack React Query handles server state, caching, and synchronization, reducing the need for global client state management.

**Build Optimization**: Vite for development speed and esbuild for production builds, providing fast build times and optimal bundle sizes.