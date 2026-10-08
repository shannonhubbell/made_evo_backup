/**
 * Test Figma API Connection
 * 
 * Tests connection to Figma API and lists files or fetches a specific file
 * to verify the API structure matches our parser implementation.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    
    return env;
  } catch (error) {
    console.warn('Could not load .env file, using process.env');
    return process.env as Record<string, string>;
  }
}

const env = loadEnv();

// Figma API configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
// Figma REST API uses Personal Access Tokens (PATs), not OAuth credentials
// Try multiple possible env var names
const FIGMA_ACCESS_TOKEN = env.FIGMA_ACCESS_TOKEN || env.FIGMA_PAT || env.FIGMA_CLIENT_SECRET || env.FIGMA_TOKEN;
const FIGMA_CLIENT_ID = env.FIGMA_CLIENT_ID;

/**
 * Make authenticated request to Figma API
 */
async function figmaRequest(endpoint: string, options: RequestInit = {}) {
  if (!FIGMA_ACCESS_TOKEN) {
    throw new Error('FIGMA_ACCESS_TOKEN or FIGMA_CLIENT_SECRET not found in .env');
  }

  const url = `${FIGMA_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Figma-Token': FIGMA_ACCESS_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Figma API error (${response.status}): ${response.statusText}\n${errorText}`
    );
  }

  return response.json();
}

/**
 * List teams for the authenticated user
 */
async function listTeams() {
  try {
    const data = await figmaRequest('/teams');
    return data.teams || [];
  } catch (error) {
    console.error('Error listing teams:', error);
    throw error;
  }
}

/**
 * List projects in a team
 */
async function listTeamProjects(teamId: string) {
  try {
    const data = await figmaRequest(`/teams/${teamId}/projects`);
    return data.projects || [];
  } catch (error) {
    console.error(`Error listing projects for team ${teamId}:`, error);
    throw error;
  }
}

/**
 * List files in a project
 */
async function listProjectFiles(projectId: string) {
  try {
    const data = await figmaRequest(`/projects/${projectId}/files`);
    return data.files || [];
  } catch (error) {
    console.error(`Error listing files for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * List files in a team (requires team ID)
 * Note: This might require different permissions
 */
async function listTeamFiles(teamId: string) {
  try {
    const projects = await listTeamProjects(teamId);
    console.log(`\nFound ${projects.length} project(s) in team ${teamId}`);
    
    const allFiles: any[] = [];
    
    // Get files from projects
    for (const project of projects) {
      console.log(`\n📁 Project: ${project.name} (${project.id})`);
      try {
        const files = await listProjectFiles(project.id);
        console.log(`   Found ${files.length} file(s)`);
        
        files.forEach((file: any) => {
          console.log(`   📄 ${file.name} - Key: ${file.key}`);
          allFiles.push(file);
        });
      } catch (error) {
        console.warn(`   ⚠️  Could not fetch files:`, error);
      }
    }
    
    return allFiles;
  } catch (error) {
    console.error('Error listing team files:', error);
    throw error;
  }
}

/**
 * Get user info to verify authentication
 */
async function getUserInfo() {
  try {
    const data = await figmaRequest('/me');
    console.log('Figma User Info:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
}

/**
 * Get a specific file by file key
 */
async function getFile(fileKey: string) {
  try {
    console.log(`\nFetching file: ${fileKey}`);
    const data = await figmaRequest(`/files/${fileKey}`);
    
    console.log('\n=== File Structure ===');
    console.log('Document ID:', data.document?.id);
    console.log('Document Name:', data.document?.name);
    console.log('Document Type:', data.document?.type);
    
    if (data.document?.children) {
      console.log(`\nTop-level children (${data.document.children.length}):`);
      data.document.children.forEach((child: any, index: number) => {
        console.log(`  ${index + 1}. ${child.name} (${child.type}) - ID: ${child.id}`);
        if (child.children) {
          console.log(`     Has ${child.children.length} children`);
        }
      });
    }
    
    // Show a sample node structure
    if (data.document?.children?.[0]?.children?.[0]) {
      const sampleNode = data.document.children[0].children[0];
      console.log('\n=== Sample Node Structure ===');
      console.log(JSON.stringify(sampleNode, null, 2).substring(0, 2000));
    }
    
    return data;
  } catch (error) {
    console.error('Error getting file:', error);
    throw error;
  }
}

/**
 * Get specific nodes from a file
 */
async function getFileNodes(fileKey: string, nodeIds: string[]) {
  try {
    const idsParam = nodeIds.join(',');
    const data = await figmaRequest(`/files/${fileKey}/nodes?ids=${idsParam}`);
    
    console.log('\n=== Node Data ===');
    console.log(JSON.stringify(data, null, 2).substring(0, 3000));
    
    return data;
  } catch (error) {
    console.error('Error getting file nodes:', error);
    throw error;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🔍 Testing Figma API Connection\n');
  console.log('=' .repeat(60));
  
  // Check credentials
  if (!FIGMA_ACCESS_TOKEN) {
    console.error('❌ Error: Figma Personal Access Token not found');
    console.log('\n📝 The Figma REST API requires a Personal Access Token (PAT), not OAuth credentials.');
    console.log('\nPlease add one of these to your .env file:');
    console.log('  FIGMA_ACCESS_TOKEN=your_personal_access_token');
    console.log('  (or)');
    console.log('  FIGMA_PAT=your_personal_access_token');
    console.log('\n🔑 How to get a Personal Access Token:');
    console.log('  1. Go to https://www.figma.com/');
    console.log('  2. Click your profile icon → Settings');
    console.log('  3. Go to the "Security" tab');
    console.log('  4. Scroll to "Personal access tokens"');
    console.log('  5. Click "Generate new token"');
    console.log('  6. Give it a name and select necessary scopes');
    console.log('  7. Copy the token (you won\'t see it again!)');
    console.log('\n📚 More info: https://help.figma.com/hc/en-us/articles/8085703771159');
    console.log('\n⚠️  Note: OAuth CLIENT_ID and CLIENT_SECRET are for OAuth flows,');
    console.log('   not for direct REST API access. You need a PAT for this script.');
    process.exit(1);
  }
  
  console.log('✓ Access token found');
  if (FIGMA_CLIENT_ID) {
    console.log('✓ Client ID found:', FIGMA_CLIENT_ID);
  }
  console.log();
  
  try {
    // 1. Test authentication
    console.log('1. Testing authentication...');
    const userInfo = await getUserInfo();
    console.log(`✓ Authenticated as: ${userInfo.email || userInfo.handle || 'Unknown'}\n`);
    
    // 2. Try to list files or get a specific file
    // Filter out npm/node arguments and flags
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--') || arg === '--list' || arg === '-l');
    const fileKey = args.find(arg => arg !== '--list' && arg !== '-l' && !arg.startsWith('-'));
    const listFiles = args.includes('--list') || args.includes('-l');
    
    if (listFiles && !fileKey) {
      console.log('2. Listing your teams and files...\n');
      try {
        const teams = await listTeams();
        console.log(`Found ${teams.length} team(s)\n`);
        
        for (const team of teams) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`👥 Team: ${team.name} (ID: ${team.id})`);
          try {
            await listTeamFiles(team.id);
          } catch (error) {
            console.warn(`   ⚠️  Could not list files for this team`);
          }
        }
      } catch (error) {
        console.error('Error listing files:', error);
      }
    } else if (fileKey) {
      console.log('2. Fetching file...');
      const fileData = await getFile(fileKey);
      
      // 3. Try to get specific nodes if provided
      const nodeIdsArg = args.find(arg => arg !== fileKey && arg !== '--list' && arg !== '-l' && !arg.startsWith('-'));
      if (nodeIdsArg) {
        const nodeIds = nodeIdsArg.split(',');
        console.log('\n3. Fetching specific nodes...');
        await getFileNodes(fileKey, nodeIds);
      }
      
      // 4. Test our parser with this real data
      console.log('\n4. Testing our Figma parser...');
      try {
        const { parseFigmaFile } = await import('../tools/contentful/figma-parser.js');
        const parsedData = await parseFigmaFile({
          accessToken: FIGMA_ACCESS_TOKEN!,
          fileKey: fileKey,
        });
        
        console.log(`\n✅ Parser extracted ${parsedData.length} design element(s)`);
        if (parsedData.length > 0) {
          console.log('\nSample extracted data:');
          console.log(JSON.stringify(parsedData[0], null, 2).substring(0, 1000));
        }
      } catch (error) {
        console.warn('\n⚠️  Could not test parser:', error instanceof Error ? error.message : error);
      }
    } else {
      console.log('2. No file key provided.');
      console.log('\nUsage:');
      console.log('  npm run test:figma --list          # List all your files');
      console.log('  npm run test:figma <file-key>      # Fetch a specific file');
      console.log('  npm run test:figma <file-key> <node-ids>  # Fetch specific nodes');
      console.log('\nTo get a file key:');
      console.log('  1. Open a Figma file');
      console.log('  2. The URL will be: https://www.figma.com/file/FILE_KEY/...');
      console.log('  3. Copy the FILE_KEY from the URL');
      console.log('\nOr use --list to see all your files');
    }
    
    console.log('\n✅ Figma API connection successful!');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
      console.log('\n💡 Authentication Error - Possible issues:');
      console.log('   1. Your token might be invalid or expired');
      console.log('   2. You might be using OAuth credentials instead of a PAT');
      console.log('   3. The token might not have the required scopes');
      console.log('\n🔑 How to get a valid Personal Access Token:');
      console.log('   1. Go to https://www.figma.com/ → Settings → Security');
      console.log('   2. Generate a new Personal Access Token');
      console.log('   3. Make sure it has "File content" scope at minimum');
      console.log('   4. Add it to .env as: FIGMA_ACCESS_TOKEN=your_token_here');
      console.log('\n📚 Docs: https://help.figma.com/hc/en-us/articles/8085703771159');
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { getUserInfo, getFile, getFileNodes, listTeamFiles };

