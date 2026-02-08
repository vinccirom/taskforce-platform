import crypto from 'crypto'

export interface Challenge {
  id: string
  type: string
  prompt: string
  answer: string // expected answer for verification
  expiresAt: number // unix timestamp ms
}

const CHALLENGE_TIMEOUT_MS = 30_000 // 30 seconds

// In-memory store (cleared on redeploy, which is fine)
const activeChallenges = new Map<string, Challenge>()

// Clean up expired challenges periodically
function cleanExpired() {
  const now = Date.now()
  for (const [id, challenge] of activeChallenges) {
    if (challenge.expiresAt < now - 60_000) { // clean 1 min after expiry
      activeChallenges.delete(id)
    }
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateChallenge(): { type: string; prompt: string; answer: string } {
  const type = randomInt(1, 5)

  switch (type) {
    case 1: {
      // Reverse string
      const str = randomString(randomInt(8, 14))
      const reversed = str.split('').reverse().join('')
      return {
        type: 'reverse_string',
        prompt: `Reverse the following string and respond with ONLY the reversed string, nothing else: "${str}"`,
        answer: reversed,
      }
    }
    case 2: {
      // Math addition
      const a = randomInt(100, 9999)
      const b = randomInt(100, 9999)
      const sum = a + b
      return {
        type: 'math',
        prompt: `What is ${a} + ${b}? Respond with ONLY the number, nothing else.`,
        answer: String(sum),
      }
    }
    case 3: {
      // Word count
      const wordPool = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango']
      const count = randomInt(4, 9)
      const words: string[] = []
      for (let i = 0; i < count; i++) {
        words.push(wordPool[randomInt(0, wordPool.length - 1)])
      }
      const sentence = words.join(' ')
      return {
        type: 'word_count',
        prompt: `How many words are in this sentence? Respond with ONLY the number, nothing else: "${sentence}"`,
        answer: String(count),
      }
    }
    case 4: {
      // Sort numbers
      const nums: number[] = []
      for (let i = 0; i < randomInt(4, 6); i++) {
        nums.push(randomInt(1, 99))
      }
      // Ensure unique
      const unique = [...new Set(nums)]
      while (unique.length < 4) unique.push(randomInt(1, 99))
      const sorted = [...unique].sort((a, b) => a - b)
      return {
        type: 'sort_numbers',
        prompt: `Sort these numbers in ascending order, separated by commas. Respond with ONLY the sorted numbers, nothing else: ${unique.join(', ')}`,
        answer: sorted.join(', '),
      }
    }
    case 5: {
      // Extract uppercase letters
      const len = randomInt(10, 16)
      let mixed = ''
      const uppers: string[] = []
      for (let i = 0; i < len; i++) {
        if (Math.random() > 0.5) {
          const upper = String.fromCharCode(65 + randomInt(0, 25))
          mixed += upper
          uppers.push(upper)
        } else {
          const lower = String.fromCharCode(97 + randomInt(0, 25))
          mixed += lower
        }
      }
      // Ensure at least 2 uppercase
      if (uppers.length < 2) {
        const u1 = String.fromCharCode(65 + randomInt(0, 25))
        const u2 = String.fromCharCode(65 + randomInt(0, 25))
        mixed = u1 + mixed + u2
        uppers.unshift(u1)
        uppers.push(u2)
      }
      return {
        type: 'extract_uppercase',
        prompt: `What are the uppercase letters in this string, in order? Respond with ONLY the uppercase letters concatenated together, nothing else: "${mixed}"`,
        answer: uppers.join(''),
      }
    }
    default:
      // Fallback to reverse
      const s = randomString(10)
      return {
        type: 'reverse_string',
        prompt: `Reverse the following string and respond with ONLY the reversed string, nothing else: "${s}"`,
        answer: s.split('').reverse().join(''),
      }
  }
}

export function createChallenge(): { challengeId: string; prompt: string; expiresAt: number } {
  cleanExpired()

  const challenge = generateChallenge()
  const id = crypto.randomUUID()
  const expiresAt = Date.now() + CHALLENGE_TIMEOUT_MS

  activeChallenges.set(id, {
    id,
    type: challenge.type,
    prompt: challenge.prompt,
    answer: challenge.answer,
    expiresAt,
  })

  return {
    challengeId: id,
    prompt: challenge.prompt,
    expiresAt,
  }
}

export function verifyChallenge(challengeId: string, answer: string): { success: boolean; error?: string } {
  const challenge = activeChallenges.get(challengeId)

  if (!challenge) {
    return { success: false, error: 'Challenge not found or already used' }
  }

  // Remove challenge (one attempt per challenge)
  activeChallenges.delete(challengeId)

  // Check expiry
  if (Date.now() > challenge.expiresAt) {
    return { success: false, error: 'Challenge expired (30 second time limit)' }
  }

  // Normalize and check answer
  const normalizedAnswer = answer.trim()
  const expectedAnswer = challenge.answer.trim()

  // Check if the answer contains the expected value
  if (normalizedAnswer === expectedAnswer || normalizedAnswer.includes(expectedAnswer)) {
    return { success: true }
  }

  // For sort_numbers, also accept without spaces after commas
  if (challenge.type === 'sort_numbers') {
    const noSpaces = expectedAnswer.replace(/\s/g, '')
    const answerNoSpaces = normalizedAnswer.replace(/\s/g, '')
    if (answerNoSpaces === noSpaces || answerNoSpaces.includes(noSpaces)) {
      return { success: true }
    }
  }

  return { success: false, error: `Incorrect answer. Expected: ${expectedAnswer}` }
}
