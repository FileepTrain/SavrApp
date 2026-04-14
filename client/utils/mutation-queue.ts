import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CACHE_KEYS,
  collectionDetailKey,
  readCache,
  writeCache,
} from "@/utils/offline-cache";
import type { MealPlanSlotEntry } from "@/utils/meal-plan-slot";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";
const QUEUE_KEY = "MUTATION_QUEUE";

// Offline meal plan create may include clientPlanId so the queue entry can be merged or removed before sync.
export type CreateMealPlanQueuedPayload = {
  breakfast: MealPlanSlotEntry[];
  lunch: MealPlanSlotEntry[];
  dinner: MealPlanSlotEntry[];
  start_date: string;
  end_date: string;
  clientPlanId?: string;
};

export type QueuedMutation =
  | { type: "DELETE_PANTRY_ITEM"; payload: { id: string } }
  | { type: "DELETE_PERSONAL_RECIPE"; payload: { id: string } }
  | { type: "CREATE_MEAL_PLAN"; payload: CreateMealPlanQueuedPayload }
  | {
      type: "UPDATE_MEAL_PLAN";
      payload: {
        planId: string;
        breakfast: MealPlanSlotEntry[];
        lunch: MealPlanSlotEntry[];
        dinner: MealPlanSlotEntry[];
        start_date: string;
        end_date: string;
      };
    }
  | { type: "DELETE_MEAL_PLAN"; payload: { planId: string } }
  | { type: "SYNC_FAVORITES"; payload: { favoriteIds: string[] } }
  | { type: "CREATE_COLLECTION"; payload: { clientCollectionId: string; name: string; recipeId?: string } }
  | { type: "DELETE_COLLECTION"; payload: { collectionId: string } }
  | {
      type: "PATCH_COLLECTION";
      payload: { collectionId: string; name?: string; recipeIds?: string[] };
    }
  | { type: "ADD_COLLECTION_RECIPE"; payload: { collectionId: string; recipeId: string } }
  | { type: "REMOVE_COLLECTION_RECIPE"; payload: { collectionId: string; recipeId: string } }
  | { type: "FOLLOW_COLLECTION"; payload: { ownerUid: string; collectionId: string } }
  | { type: "UNFOLLOW_COLLECTION"; payload: { ownerUid: string; collectionId: string } };

async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage failures
  }
}

export async function getPendingMutationCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
  const queue = await readQueue();
  queue.push(mutation);
  await writeQueue(queue);
}

export async function mergePendingMealPlanEdit(
  clientPlanId: string,
  payload: Omit<CreateMealPlanQueuedPayload, "clientPlanId">,
): Promise<boolean> {
  const queue = await readQueue();
  const idx = queue.findIndex(
    (m) => m.type === "CREATE_MEAL_PLAN" && m.payload.clientPlanId === clientPlanId,
  );
  if (idx === -1) return false;
  const current = queue[idx] as Extract<QueuedMutation, { type: "CREATE_MEAL_PLAN" }>;
  queue[idx] = {
    type: "CREATE_MEAL_PLAN",
    payload: {
      ...current.payload,
      ...payload,
      clientPlanId,
    },
  };
  await writeQueue(queue);
  return true;
}

export async function removeQueuedMealPlanCreate(clientPlanId: string): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter(
    (m) =>
      !(m.type === "CREATE_MEAL_PLAN" && m.payload.clientPlanId === clientPlanId),
  );
  await writeQueue(next);
}

export async function removeQueuedCollectionCreate(clientCollectionId: string): Promise<void> {
  const queue = await readQueue();
  const next = queue.filter((m) => {
    if (m.type === "CREATE_COLLECTION" && m.payload.clientCollectionId === clientCollectionId) {
      return false;
    }
    if (
      (m.type === "ADD_COLLECTION_RECIPE" ||
        m.type === "REMOVE_COLLECTION_RECIPE" ||
        m.type === "PATCH_COLLECTION" ||
        m.type === "DELETE_COLLECTION") &&
      m.payload.collectionId === clientCollectionId
    ) {
      return false;
    }
    return true;
  });
  await writeQueue(next);
}

function rewriteCollectionIdInQueue(
  queue: QueuedMutation[],
  oldId: string,
  newId: string,
): QueuedMutation[] {
  return queue.map((m) => {
    if (
      (m.type === "ADD_COLLECTION_RECIPE" ||
        m.type === "REMOVE_COLLECTION_RECIPE" ||
        m.type === "PATCH_COLLECTION" ||
        m.type === "DELETE_COLLECTION") &&
      m.payload.collectionId === oldId
    ) {
      return { ...m, payload: { ...m.payload, collectionId: newId } } as QueuedMutation;
    }
    return m;
  });
}

async function remapCollectionCachesAfterCreate(
  clientId: string,
  serverId: string,
  name: string,
  recipeIds: string[],
) {
  const list = await readCache<unknown[]>(CACHE_KEYS.COLLECTIONS_MINE);
  if (Array.isArray(list)) {
    const next = list.map((row: any) =>
      row?.id === clientId
        ? {
            ...row,
            id: serverId,
            name: typeof row.name === "string" ? row.name : name,
            recipeIds,
            recipeCount: recipeIds.length,
          }
        : row,
    );
    await writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
  }

  const oldKey = collectionDetailKey("me", clientId);
  const raw = await AsyncStorage.getItem(oldKey);
  if (raw != null) {
    const newKey = collectionDetailKey("me", serverId);
    await AsyncStorage.setItem(newKey, raw);
    await AsyncStorage.removeItem(oldKey);
  }
}

type ReplayResult = {
  ok: boolean;
  collectionIdRewrite?: { oldId: string; newId: string };
};

async function replayMutation(mutation: QueuedMutation, idToken: string): Promise<ReplayResult> {
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
      return { ok: res.ok };
    }

    case "DELETE_PERSONAL_RECIPE": {
      const res = await fetch(`${SERVER_URL}/api/recipes/${mutation.payload.id}`, {
        method: "DELETE",
        headers,
      });
      return { ok: res.ok };
    }

    case "CREATE_MEAL_PLAN": {
      const { clientPlanId: _c, ...body } = mutation.payload;
      const res = await fetch(`${SERVER_URL}/api/meal-plans`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return { ok: res.ok };
    }

    case "UPDATE_MEAL_PLAN": {
      const { planId, breakfast, lunch, dinner, start_date, end_date } = mutation.payload;
      const res = await fetch(`${SERVER_URL}/api/meal-plans/${encodeURIComponent(planId)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ breakfast, lunch, dinner, start_date, end_date }),
      });
      return { ok: res.ok };
    }

    case "DELETE_MEAL_PLAN": {
      const res = await fetch(
        `${SERVER_URL}/api/meal-plans/${encodeURIComponent(mutation.payload.planId)}`,
        { method: "DELETE", headers },
      );
      return { ok: res.ok || res.status === 404 };
    }

    case "SYNC_FAVORITES": {
      const res = await fetch(`${SERVER_URL}/api/auth/update-favorites`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ favoriteIds: mutation.payload.favoriteIds }),
      });
      return { ok: res.ok };
    }

    case "CREATE_COLLECTION": {
      const { clientCollectionId, name, recipeId } = mutation.payload;
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, ...(recipeId ? { recipeId } : {}) }),
      });
      if (!res.ok) return { ok: false };
      const data = await res.json().catch(() => ({}));
      const serverId = typeof data?.collection?.id === "string" ? data.collection.id : null;
      if (!serverId) return { ok: true };
      const recipeIds: string[] = Array.isArray(data?.collection?.recipeIds)
        ? data.collection.recipeIds
        : recipeId
          ? [recipeId]
          : [];
      await remapCollectionCachesAfterCreate(clientCollectionId, serverId, name, recipeIds);
      return { ok: true, collectionIdRewrite: { oldId: clientCollectionId, newId: serverId } };
    }

    case "DELETE_COLLECTION": {
      const res = await fetch(
        `${SERVER_URL}/api/auth/collections/${encodeURIComponent(mutation.payload.collectionId)}`,
        { method: "DELETE", headers },
      );
      return { ok: res.ok || res.status === 404 };
    }

    case "PATCH_COLLECTION": {
      const { collectionId, ...patch } = mutation.payload;
      const res = await fetch(
        `${SERVER_URL}/api/auth/collections/${encodeURIComponent(collectionId)}`,
        { method: "PATCH", headers, body: JSON.stringify(patch) },
      );
      return { ok: res.ok };
    }

    case "ADD_COLLECTION_RECIPE": {
      const res = await fetch(
        `${SERVER_URL}/api/auth/collections/${encodeURIComponent(mutation.payload.collectionId)}/recipes`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ recipeId: mutation.payload.recipeId }),
        },
      );
      return { ok: res.ok };
    }

    case "REMOVE_COLLECTION_RECIPE": {
      const res = await fetch(
        `${SERVER_URL}/api/auth/collections/${encodeURIComponent(mutation.payload.collectionId)}/recipes/${encodeURIComponent(mutation.payload.recipeId)}`,
        { method: "DELETE", headers },
      );
      return { ok: res.ok || res.status === 404 };
    }

    case "FOLLOW_COLLECTION": {
      const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ownerUid: mutation.payload.ownerUid,
          collectionId: mutation.payload.collectionId,
        }),
      });
      return { ok: res.ok };
    }

    case "UNFOLLOW_COLLECTION": {
      const res = await fetch(
        `${SERVER_URL}/api/auth/followed-collections/${encodeURIComponent(mutation.payload.ownerUid)}/${encodeURIComponent(mutation.payload.collectionId)}`,
        { method: "DELETE", headers },
      );
      return { ok: res.ok || res.status === 404 };
    }

  }
}

export async function processMutationQueue(): Promise<void> {
  let remaining = await readQueue();
  if (remaining.length === 0) return;

  const idToken = await AsyncStorage.getItem("idToken");
  if (!idToken) return;

  const failed: QueuedMutation[] = [];

  while (remaining.length > 0) {
    const mutation = remaining[0];
    const tail = remaining.slice(1);
    const result = await replayMutation(mutation, idToken);
    if (!result.ok) {
      failed.push(mutation);
      remaining = tail;
      continue;
    }
    if (result.collectionIdRewrite) {
      remaining = rewriteCollectionIdInQueue(
        tail,
        result.collectionIdRewrite.oldId,
        result.collectionIdRewrite.newId,
      );
    } else {
      remaining = tail;
    }
  }

  await writeQueue(failed);
}
