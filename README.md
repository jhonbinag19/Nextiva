# Nextiva API Server

This is a server implementation for Nextiva that provides secure authentication via Thrio login system. It offers endpoints for authentication, lead management, and list management with comprehensive data synchronization capabilities.

**Last Updated:** $(date)
**Version:** 1.0.0

## Features

- **Authentication**: Secure username/password authentication via Thrio login system
- **JWT Token Management**: Secure API access using JWT tokens with refresh capability
- **Lead Management**: Create, read, update, and delete leads
- **List Management**: Create, read, update, and delete lists
- **Two-way Synchronization**: Sync data between systems
- **Role-based Access**: User authorities and permissions management

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Local Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables by copying `.env.example` to `.env` and updating the values:

```bash
cp .env.example .env
```

4. Start the server:

```bash
npm start
```

### Deploying to Vercel

This project is configured for deployment on Vercel's serverless platform.

1. Install the Vercel CLI:

```bash
npm install -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

3. Deploy to Vercel:

```bash
vercel
```

4. For production deployment:

```bash
vercel --prod
```

5. Configure environment variables in the Vercel dashboard or using the CLI:

```bash
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
# Add other required environment variables
```

The project includes a `vercel.json` configuration file that sets up the proper build and routing for the serverless environment.

## API Documentation

### Authentication

#### Get Token

```
POST /api/auth/token
```

Request body:
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresIn": 86400,
  "tokenType": "Bearer",
  "user": {
    "id": "user_id",
    "username": "your_username",
    "authorities": ["ROLE_USER"]
  }
}
```

#### Verify Token

```
GET /api/auth/verify
```

Headers:
```
Authorization: Bearer jwt_token
```

Response:
```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "username": "your_username",
    "userId": "user_id",
    "authorities": ["ROLE_USER"]
  }
}
```

#### Refresh Token

```
POST /api/auth/refresh
```

Request body:
```json
{
  "refreshToken": "refresh_token"
}
```

Response:
```json
{
  "success": true,
  "token": "new_jwt_token",
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

### Leads

#### Get All Leads

```
GET /api/leads
```

Query parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of leads per page (default: 20)
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort order (asc or desc, default: desc)

#### Get Lead by ID

```
GET /api/leads/:id
```

#### Create Lead

```
POST /api/leads
```

Request body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "status": "new",
  "source": "website",
  "customFields": {},
  "syncToGhl": true
}
```

#### Update Lead

```
PUT /api/leads/:id
```

Request body: Same as create lead

#### Delete Lead

```
DELETE /api/leads/:id
```

Query parameters:
- `syncToGhl` (optional): Whether to also delete the lead in GoHighLevel (true or false)

#### Search Leads

```
POST /api/leads/search
```

Request body:
```json
{
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "status": "new",
  "source": "website"
}
```

#### Bulk Create Leads

```
POST /api/leads/bulk
```

Request body:
```json
{
  "leads": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com"
    }
  ],
  "syncToGhl": true
}
```

#### Bulk Update Leads

```
PUT /api/leads/bulk
```

Request body:
```json
{
  "leads": [
    {
      "id": "lead_id_1",
      "status": "qualified"
    },
    {
      "id": "lead_id_2",
      "status": "disqualified"
    }
  ],
  "syncToGhl": true
}
```

### Lists

#### Get All Lists

```
GET /api/lists
```

Query parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of lists per page (default: 20)
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort order (asc or desc, default: desc)

#### Get List by ID

```
GET /api/lists/:id
```

#### Create List

```
POST /api/lists
```

Request body:
```json
{
  "name": "VIP Customers",
  "description": "List of VIP customers",
  "type": "customer",
  "tags": ["vip", "customer"],
  "syncToGhl": true
}
```

#### Update List

```
PUT /api/lists/:id
```

Request body: Same as create list

#### Delete List

```
DELETE /api/lists/:id
```

Query parameters:
- `syncToGhl` (optional): Whether to also delete the list in GoHighLevel (true or false)

#### Get List Leads

```
GET /api/lists/:id/leads
```

Query parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of leads per page (default: 20)

#### Add Leads to List

```
POST /api/lists/:id/leads
```

Request body:
```json
{
  "leadIds": ["lead_id_1", "lead_id_2"],
  "syncToGhl": true
}
```

#### Remove Lead from List

```
DELETE /api/lists/:id/leads/:leadId
```

Query parameters:
- `syncToGhl` (optional): Whether to also remove the lead from the list in GoHighLevel (true or false)

#### Sync List

```
POST /api/lists/:id/sync
```

Request body:
```json
{
  "direction": "both"
}
```

Options for `direction`:
- `to-ghl`: Sync from Nextiva to GoHighLevel
- `from-ghl`: Sync from GoHighLevel to Nextiva
- `both`: Sync in both directions (default)

## Outbound List

Add a lead to an outbound list:

```
POST /data/api/types/outboundlist/:outboundListId/leadsupsert
```

## SMS

Send SMS via workflow webform proxy:

```
ANY /workflows/api/webform
ANY /workflows/api/webform/*
```

## GoHighLevel Integration

This API server is designed to work with GoHighLevel marketplace, workflows, and triggers. It provides two-way synchronization between Nextiva and GoHighLevel for leads and lists.

### Authentication

To authenticate with the API from GoHighLevel, you need to:

1. Store your GoHighLevel API key in GoHighLevel
2. Use the API key to get a JWT token from the `/api/auth/token` endpoint
3. Use the JWT token in the `Authorization` header for subsequent requests

### Workflows and Triggers

You can use this API in GoHighLevel workflows and triggers to:

- Create leads in Nextiva when new contacts are added in GoHighLevel
- Update leads in Nextiva when contacts are updated in GoHighLevel
- Create and manage lists in Nextiva based on tags in GoHighLevel
- Trigger actions in GoHighLevel when leads or lists are updated in Nextiva

## License

This project is licensed under the MIT License - see the LICENSE file for details.
