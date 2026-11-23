import BoardLibrary from "./components/BoardLibrary";

export default function App() {
  const server = document.querySelector('meta[name="whiteboard-storage"][content="server"]');
  return <BoardLibrary server={Boolean(server)} />;
}
