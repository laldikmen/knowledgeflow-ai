const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'knowledgeflow_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: { rejectUnauthorized: false },
});

const testUsers = [
  { email: 'admin@test.com', password: 'test123', name: 'Admin User', role: 'admin' },
  { email: 'manager@test.com', password: 'test123', name: 'Manager User', role: 'member' },
  { email: 'contributor@test.com', password: 'test123', name: 'Contributor User', role: 'member' },
  { email: 'viewer@test.com', password: 'test123', name: 'Viewer User', role: 'member' },
];

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    for (const user of testUsers) {
      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Insert the user
      const result = await pool.query(
        `INSERT INTO users (email, name, password_hash, system_role, account_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           password_hash = $3,
           name = $2,
           system_role = $4,
           account_status = $5
         RETURNING id, email, name, system_role`,
        [user.email, user.name, passwordHash, user.role, 'active']
      );

      console.log(`✓ Created/Updated user: ${result.rows[0].email} (${result.rows[0].system_role})`);
    }

    console.log('\nTest users created successfully!');
    console.log('\nYou can now login with:');
    testUsers.forEach(user => {
      console.log(`  Email: ${user.email}, Password: ${user.password}, Role: ${user.role}`);
    });

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await pool.end();
  }
}

createTestUsers();
