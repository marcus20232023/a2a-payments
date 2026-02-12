#!/usr/bin/env node

/**
 * Password Migration Script: SHA-256 to Bcrypt
 * 
 * This script migrates existing user passwords from SHA-256 hashing to bcrypt.
 * 
 * IMPORTANT: This script requires plaintext passwords to be available. Since
 * SHA-256 hashes are one-way, plaintext passwords cannot be recovered from existing hashes.
 * 
 * Migration Strategy:
 * 1. If plaintext passwords are available: Use this script to rehash them with bcrypt
 * 2. If plaintext passwords are NOT available: Clear auth-users.json and require users to re-signup
 * 
 * Current approach: Users require re-signup with bcrypt
 */

const fs = require('fs');
const bcrypt = require('bcryptjs');

const AUTH_USERS_PATH = './auth-users.json';
const BCRYPT_SALT_ROUNDS = 10;

/**
 * This function would be used IF we had plaintext passwords
 * Example: migratePassword('plaintext_password', 'existing_sha256_hash')
 * 
 * Since we don't have plaintext passwords, this is for documentation only.
 */
function migratePassword(plaintextPassword, oldSha256Hash) {
  // Generate new bcrypt hash
  const newBcryptHash = bcrypt.hashSync(plaintextPassword, BCRYPT_SALT_ROUNDS);
  
  return {
    oldHash: oldSha256Hash,
    newHash: newBcryptHash,
    method: 'bcryptjs',
    saltRounds: BCRYPT_SALT_ROUNDS,
    timestamp: new Date().toISOString()
  };
}

/**
 * Migrate all users in auth-users.json
 * This requires plaintext passwords to be provided separately
 */
function migrateAllUsers(plaintextPasswordsMap) {
  try {
    if (!fs.existsSync(AUTH_USERS_PATH)) {
      console.log('No auth-users.json found. Skipping migration.');
      return;
    }

    const users = JSON.parse(fs.readFileSync(AUTH_USERS_PATH, 'utf8'));
    let migratedCount = 0;

    for (const [userId, user] of Object.entries(users)) {
      // Look up plaintext password for this user
      const plaintextPassword = plaintextPasswordsMap[user.walletAddress];
      
      if (plaintextPassword) {
        const migration = migratePassword(plaintextPassword, user.passwordHash);
        user.passwordHash = migration.newHash;
        user.bcryptMigrated = true;
        user.bcryptMigratedAt = migration.timestamp;
        migratedCount++;
      } else {
        console.warn(`No plaintext password found for user ${userId} (${user.walletAddress})`);
      }
    }

    // Backup original file
    const backupPath = `${AUTH_USERS_PATH}.sha256-backup-${Date.now()}.json`;
    fs.copyFileSync(AUTH_USERS_PATH, backupPath);
    console.log(`Backup saved to: ${backupPath}`);

    // Save migrated users
    fs.writeFileSync(AUTH_USERS_PATH, JSON.stringify(users, null, 2));
    console.log(`✅ Migration complete: ${migratedCount}/${Object.keys(users).length} users migrated to bcrypt`);

    return migratedCount;
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// Example usage (requires plaintext passwords)
if (require.main === module) {
  console.log('🔐 Password Migration: SHA-256 → Bcrypt');
  console.log('=====================================\n');
  
  console.log('ℹ️  This script requires plaintext passwords to migrate existing users.');
  console.log('Since SHA-256 is one-way, plaintext passwords cannot be recovered.\n');
  
  console.log('Current Status: Using re-signup strategy');
  console.log('- Cleared existing SHA-256 hashes from auth-users.json');
  console.log('- Users will create new accounts with bcrypt-hashed passwords\n');
  
  console.log('Alternative: If plaintext passwords are available:');
  console.log('  const passwordMap = {');
  console.log('    "0xWallet1": "plaintext_password_1",');
  console.log('    "0xWallet2": "plaintext_password_2"');
  console.log('  };');
  console.log('  migrateAllUsers(passwordMap);\n');
}

module.exports = { migratePassword, migrateAllUsers };
