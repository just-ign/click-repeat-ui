import { Input } from "@/components/ui/input";
import { useState } from "react";

function App() {
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      window.electronAPI.handleQuery(inputValue)
        .then(result => {
          console.log("Query result:", result);
        })
        .catch(err => {
          console.error("Error in handleQuery:", err);
        });
      
      setInputValue("");
    }
  };

  return (
    <div className="dark flex flex-col items-center justify-center h-screen w-screen bg-background">
      <Input
        placeholder="Computer Agent"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleSubmit}
        className="w-full h-full text-xl border-none"
        style={{
          backgroundColor: "var(--secondary)",
          color: "var(--foreground)",
        }}
      />
    </div>
  );
}

export default App;
