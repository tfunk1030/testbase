export class CalculationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly params?: any
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof CalculationError) {
    return {
      status: 400,
      body: {
        error: error.message,
        code: error.code,
        params: error.params
      }
    };
  }

  console.error(error);
  return {
    status: 500,
    body: {
      error: 'Internal server error'
    }
  };
}
