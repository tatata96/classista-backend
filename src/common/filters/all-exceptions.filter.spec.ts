import { ArgumentsHost, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createMockHost(url = '/test') {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('formats a NestJS HttpException using its own status, message and the request path', () => {
    const { host, response } = createMockHost('/categories/123');

    filter.catch(new NotFoundException('Category not found'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Category not found',
        path: '/categories/123',
      }),
    );
  });

  it('hides internal details for an unexpected error but still logs it server-side', () => {
    const { host, response } = createMockHost('/boom');
    const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('leaked db password in stack trace'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Something went wrong. Please try again later.',
        path: '/boom',
      }),
    );

    const [reportedBody] = response.json.mock.calls[0] as [{ message: string }];
    expect(reportedBody.message).not.toContain('leaked db password');
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });
});
