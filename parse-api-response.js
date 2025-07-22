#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses an API response file containing Server-Sent Events (SSE) format
 * and converts it into an array of message objects compatible with MsgProps.
 *
 * @param {string} filePath - Path to the API response file
 * @returns {Array} Array of message objects
 */
export function parseApiResponseToMessages(filePath) {
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    const messages = [];
    let conversationId = '';
    let currentBotMessage = {
      role: 'bot',
      content: '',
      name: 'AI',
      avatar: '', // Will be set by the UI component
      timestamp: '',
    };

    for (const line of lines) {
      // Skip lines that don't start with "data: "
      if (!line.startsWith('data: ')) {
        continue;
      }

      try {
        // Parse the JSON after "data: "
        const jsonStr = line.slice(5).trim();
        const event = JSON.parse(jsonStr);

        switch (event.event) {
          case 'start':
            conversationId = event.data.conversation_id;
            // Reset bot message for new conversation
            currentBotMessage = {
              role: 'bot',
              content: '',
              name: 'AI',
              avatar: '',
              timestamp: new Date().toLocaleString(),
            };
            break;

          case 'token':
            // Only process inference tokens (AI responses)
            if (event.data.role === 'inference') {
              currentBotMessage.content += event.data.token;
            }
            break;

          case 'end':
            // Finalize the bot message if it has content
            if (currentBotMessage.content.trim()) {
              messages.push({
                ...currentBotMessage,
                content: currentBotMessage.content.trim(),
              });
            }
            break;
        }
      } catch (parseError) {
        console.warn(`Warning: Failed to parse line: ${line}`, parseError.message);
      }
    }

    return messages;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Creates a complete conversation array including a mock user message
 * that would have triggered the AI response.
 *
 * @param {string} filePath - Path to the API response file
 * @param {string} userQuestion - The user question that triggered this response
 * @param {string} username - Username for the user message
 * @returns {Array} Array of message objects including user and bot messages
 */
export function parseApiResponseToConversation(
  filePath,
  userQuestion = 'What operator bundles can I add to my cluster?',
  username = 'User',
) {
  const botMessages = parseApiResponseToMessages(filePath);

  if (botMessages.length === 0) {
    return [];
  }

  // Create a user message that would have triggered the response
  const userMessage = {
    role: 'user',
    content: userQuestion,
    name: username,
    avatar: '', // Will be set by the UI component
    timestamp: new Date(Date.now() - 1000).toLocaleString(), // 1 second before bot response
  };

  return [userMessage, ...botMessages];
}

// CLI usage - check if this file is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node parse-api-response.js <file-path> [user-question] [username]');
    console.log('');
    console.log('Examples:');
    console.log('  node parse-api-response.js api-response.txt');
    console.log('  node parse-api-response.js api-response.txt "What operators are available?"');
    console.log('  node parse-api-response.js api-response.txt "Help me with operators" "John"');
    process.exit(1);
  }

  const filePath = args[0];
  const userQuestion = args[1];
  const username = args[2];

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File ${filePath} does not exist.`);
    process.exit(1);
  }

  console.log(`Parsing ${filePath}...`);

  if (userQuestion || username) {
    // Generate full conversation
    const conversation = parseApiResponseToConversation(filePath, userQuestion, username);
    console.log('\nFull conversation:');
    console.log(JSON.stringify(conversation, null, 2));
  } else {
    // Generate only bot messages
    const messages = parseApiResponseToMessages(filePath);
    console.log('\nBot messages only:');
    console.log(JSON.stringify(messages, null, 2));
  }

  console.log(
    `\nGenerated ${userQuestion || username ? 'conversation' : 'messages'} array with ${
      userQuestion || username
        ? parseApiResponseToConversation(filePath, userQuestion, username).length
        : parseApiResponseToMessages(filePath).length
    } message(s).`,
  );
}
