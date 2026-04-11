import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";
const QUEUE_KEY = "MUTATION_QUEUE";

// Describes each offline write operation that must be replayed when connectivity resumes.
export type QueuedMutation =
  | { type: "DELETE_PANTRY_ITEM"; payload: { id: string } }
  | { type: "DELETE_PERSONAL_RECIPE"; payload: { id: string } }
  | {
      type: "CREATE_MEAL_PLAN";
      payload: {
        breakfast: string[];
        lunch: string[];
        dinner: string[];
        start_date: string;
        end_date: string;
      };
    }
  | { type: "SYNC_FAVORITES"; payload: { favoriteIds: string[] } };

// Reads the full queue from AsyncStorage. Returns an empty array if nothing is stored.
async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

// Persists the full queue to AsyncStorage.
async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage failures
  }
}

// Returns the number of mutations waiting to be synced.
export async function getPendingMutationCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

// Appends a single mutation to the persisted queue.
export async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
  const queue = await readQueue();
  queue.push(mutation);
  await writeQueue(queue);
}

// Attempts to replay each queued mutation against the server.
// Mutations that succeed are removed from the queue; failed ones are kept so they
// can be retried on the next reconnect.
export async function processMutationQueue(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const idToken = await AsyncStorage.getItem("idToken");
  if (!idToken) return;

  const remaining: QueuedMutation[] = [];

  for (const mutation of queue) {
    try {
      const succeeded = await replayMutation(mutation, idToken);
      if (!succeeded) remaining.push(mutation);
    } catch {
      // Keep failed mutations in the queue for the next attempt.
      remaining.push(mutation);
    }
  }

  await writeQueue(remaining);
}

// Dispatches a single mutation to the correct API endpoint.
// Returns true when the server accepted the request (2xx status).
async function replayMutation(mutation: QueuedMutation, idToken: string): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };

  switch (mutation.type) {
    case "DELETE_PANTRY_ITEM": {
      const res = await fetch(`${SERVER_URL}/api/pantry/${mutation.payload.id}`, {
        method: "DELETE",
        headers,
      });
      return res.ok;
    }

    case "DELETE_PERSONAL_RECIPE": {
      const res = await fetch(`${SERVER_URL}/api/recipes/${mutation.payload.id}`, {
        method: "DELETE",
        headers,
      });
      return res.ok;
    }

    case "CREATE_MEAL_PLAN": {
      const res = await fetch(`${SERVER_URL}/api/meal-plans`, {
        method: "POST",
        headers,
        body: JSON.stringify(mutation.payload),
      });
      return res.ok;
    }

    case "SYNC_FAVORITES": {
      const res = await fetch(`${SERVER_URL}/api/auth/update-favorites`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ favoriteIds: mutation.payload.favoriteIds }),
      });
      return res.ok;
    }

    default:
      // Unknown mutation type; drop it so it does not block the queue.
      return true;
  }
}
