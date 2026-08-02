import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ParserDemo from './pages/ParserDemo';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ParserDemo />
    </QueryClientProvider>
  );
}

export default App;
