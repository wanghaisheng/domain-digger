import { env } from '@/env';
import { AlibabaDoHResolver } from '@/lib/resolvers/alibaba';
import { ALL_RECORD_TYPES, type RecordType } from '@/lib/resolvers/base';
import { CloudflareDoHResolver } from '@/lib/resolvers/cloudflare';
import { GoogleDoHResolver } from '@/lib/resolvers/google';

if (env.NODE_ENV === 'production' && !env.INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET is required in production');
}

export const handler = async (request: Request) => {
  if (
    env.INTERNAL_API_SECRET &&
    env.INTERNAL_API_SECRET !== request.headers.get('authorization')
  ) {
    return Response.json(
      {
        error: true,
        message: 'Unauthorized',
      },
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const resolverName = searchParams.get('resolver');
  const types = searchParams.getAll('type');
  const domain = searchParams.get('domain');

  if (!resolverName || !types.length || !domain) {
    return Response.json(
      {
        error: true,
        message: '"resolver", "type" and "domain" params are required',
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  if (!['alibaba', 'cloudflare', 'google'].includes(resolverName)) {
    return Response.json(
      {
        error: true,
        message: `Invalid resolver "${resolverName}"`,
      },
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  for (const type of types) {
    // @ts-expect-error
    if (!ALL_RECORD_TYPES.includes(type)) {
      return Response.json(
        {
          error: true,
          message: `Invalid record type "${type}"`,
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }

  // TODO Clean up this mess
  const resolver =
    resolverName === 'alibaba'
      ? new AlibabaDoHResolver()
      : resolverName === 'cloudflare'
        ? new CloudflareDoHResolver()
        : new GoogleDoHResolver();
  const records = Object.fromEntries(
    await Promise.all(
      types.map(async (type) => [
        type,
        await resolver.resolveRecordType(domain, type as RecordType),
      ])
    )
  );

  return Response.json(records);
};
