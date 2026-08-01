export type ReflectionDeletionState<TThread, TTurn> = {
  source: "local_demo" | "supabase";
  deletedThreadId: string;
  reflectionThreads: TThread[];
  threadId: (thread: TThread) => string;
  activeThreadId: string | null;
  chatTurns: TTurn[];
};

export function applyConfirmedReflectionDeletion<TThread, TTurn>(
  state: ReflectionDeletionState<TThread, TTurn>
): {
  reflectionThreads: TThread[];
  activeThreadId: string | null;
  chatTurns: TTurn[];
  forceNewThread: boolean;
} {
  if (state.source === "local_demo") {
    return {
      reflectionThreads: state.reflectionThreads,
      activeThreadId: null,
      chatTurns: [],
      forceNewThread: false
    };
  }

  const deletedActiveThread = state.activeThreadId === state.deletedThreadId;
  return {
    reflectionThreads: state.reflectionThreads.filter(
      (thread) => state.threadId(thread) !== state.deletedThreadId
    ),
    activeThreadId: deletedActiveThread ? null : state.activeThreadId,
    chatTurns: deletedActiveThread ? [] : state.chatTurns,
    forceNewThread: deletedActiveThread
  };
}
