import { pool } from './src/db/connection';
import bcrypt from 'bcrypt';

async function setupTestData() {
  try {
    // Insert admin user
    const adminHash = bcrypt.hashSync('test123', 10);
    const adminResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, system_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3
       RETURNING id, email`,
      ['Test Admin', 'admin@test.com', adminHash, 'admin']
    );
    console.log('✓ Admin user:', adminResult.rows[0]);

    // Insert regular member user
    const memberHash = bcrypt.hashSync('test123', 10);
    const memberResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, system_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3
       RETURNING id, email`,
      ['Test Manager', 'manager@test.com', memberHash, 'member']
    );
    console.log('✓ Manager user:', memberResult.rows[0]);

    // Insert contributor user
    const contributorHash = bcrypt.hashSync('test123', 10);
    const contributorResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, system_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $3
       RETURNING id, email`,
      ['Test Contributor', 'contributor@test.com', contributorHash, 'member']
    );
    console.log('✓ Contributor user:', contributorResult.rows[0]);

    // Create test project
    const projectResult = await pool.query(
      `INSERT INTO projects (name, department_name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name`,
      ['Test Project Alpha', 'Engineering', 'Test project for Phase 4', adminResult.rows[0].id]
    );
    console.log('✓ Test project:', projectResult.rows[0]);

    // Add members to project
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, project_role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [projectResult.rows[0].id, memberResult.rows[0].id, 'manager', adminResult.rows[0].id]
    );
    console.log('✓ Added manager to project');

    await pool.query(
      `INSERT INTO project_members (project_id, user_id, project_role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [projectResult.rows[0].id, contributorResult.rows[0].id, 'contributor', adminResult.rows[0].id]
    );
    console.log('✓ Added contributor to project');

    console.log('\n✅ Test data setup complete!');
    console.log('\nTest credentials:');
    console.log('Admin: admin@test.com / test123');
    console.log('Manager: manager@test.com / test123');
    console.log('Contributor: contributor@test.com / test123');
    console.log('\nTest Project ID:', projectResult.rows[0].id);

    await pool.end();
  } catch (error) {
    console.error('Setup error:', error);
    await pool.end();
    process.exit(1);
  }
}

setupTestData();
