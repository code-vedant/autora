import { useState } from "react";
import { toast } from "sonner";

type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

function useFetch<T = any>(cb: AsyncFunction<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fn = async (...args: Parameters<typeof cb>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await cb(...args);
      setData(response);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An unknown error occurred");
      setError(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData };
}

export default useFetch;
