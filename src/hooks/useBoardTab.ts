import { useEffect, useState } from "react";

export function useBoardTab(boardKey: string) {
  const [replaced, setReplaced] = useState(false);
  const [replacedAnother, setReplacedAnother] = useState(false);

  useEffect(() => {
    const channel = new BroadcastChannel("whiteboard:" + boardKey);
    const openedAt = performance.timeOrigin + performance.now();
    const id = crypto.randomUUID();
    let active = true;

    channel.onmessage = ({ data }) => {
      if (data?.type === "replaced" && data.id === id) {
        if (active) setReplacedAnother(true);
      } else if (data?.type === "opened" && active &&
          (data.openedAt > openedAt || (data.openedAt === openedAt && data.id > id))) {
        active = false;
        setReplaced(true);
        channel.postMessage({ type: "replaced", id: data.id });
      }
    };
    channel.postMessage({ type: "opened", openedAt, id });
    return () => channel.close();
  }, [boardKey]);

  return { replaced, replacedAnother };
}
