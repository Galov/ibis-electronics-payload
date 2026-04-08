import 'dotenv/config'

import configPromise from '@payload-config'
import type { Page } from '@/payload-types'
import { getPayload } from 'payload'

const createHeroRichText = () =>
  ({
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [
        {
          type: 'heading',
          tag: 'h1',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              text: 'За нас',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              text: 'Ibis Electronics е сервиз за битова техника и електроника.',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }) satisfies NonNullable<NonNullable<Page['hero']>['richText']>

async function main() {
  const payload = await getPayload({ config: configPromise })

  const layout = [
    {
      blockType: 'serviceCards' as const,
      blockName: 'Кои сме',
      eyebrow: 'Ibis Electronics',
      title: 'Кои сме',
      description: 'Работим в сферата на битовата техника и електрониката.',
      items: [
        {
          title: 'Специализация в сервиз и поддръжка',
          description: 'Работим по ремонт и поддръжка на битова техника и електроника.',
          highlights: [
            { text: 'Ежедневна сервизна работа' },
            { text: 'Практичен подход' },
          ],
        },
        {
          title: 'Официален сервиз на разпознаваеми марки',
          description: 'Оторизирани сме за редица марки и работим с оригинални части при нужда.',
          tags: [
            { label: 'Arielli' },
            { label: 'Diplomat' },
            { label: 'Tesy' },
            { label: 'Cata' },
            { label: 'Piramis' },
            { label: 'Delonghi' },
          ],
          highlights: [
            { text: 'Работа по стандарти на марката' },
            { text: 'Оригинални части' },
          ],
        },
        {
          title: 'Подкрепени от силна база с резервни части',
          description: 'Работим в тясна връзка с „Ник-Електрик“ ЕООД.',
          highlights: [
            { text: 'По-добра наличност на части' },
            { text: 'По-ясни срокове' },
          ],
        },
      ],
    },
    {
      blockType: 'infoSteps' as const,
      blockName: 'Какво е важно за нас',
      eyebrow: 'Нашият подход',
      title: 'Какво е важно за нас',
      description: 'Държим на качествен ремонт и ясно отношение към клиента.',
      items: [
        {
          title: 'Диагностика с реална преценка',
          summary: 'Първо гледаме смисъла',
          description: 'Оценяваме повредата и рентабилността на ремонта.',
        },
        {
          title: 'Качествено изпълнение',
          summary: 'Не правим компромис с ремонта',
          description: 'Приоритет са качествено извършените ремонти и подходящите части.',
        },
        {
          title: 'Лично отношение',
          summary: 'Комуникацията има значение',
          description: 'Държим клиентът да знае какво се случва и какви са опциите.',
        },
      ],
    },
    {
      blockType: 'serviceCards' as const,
      blockName: 'Защо клиентите идват при нас',
      eyebrow: 'Доверие и практичност',
      title: 'Защо клиентите идват при нас',
      description: 'Комбинираме практически опит, достъп до части и нормална комуникация.',
      items: [
        {
          title: 'Честен разговор',
          description: 'Казваме директно кога ремонтът си струва и кога не.',
        },
        {
          title: 'Практически опит',
          description: 'Техниците ни имат дългогодишен опит в техниката и електрониката.',
        },
        {
          title: 'Решения, не само услуги',
          description: 'При нужда съдействаме и с части, и с консултация.',
        },
      ],
    },
  ] satisfies NonNullable<Page['layout']>

  const pageData = {
    _status: 'published' as const,
    slug: 'za-nas',
    title: 'За нас',
    hero: {
      type: 'lowImpact' as const,
      richText: createHeroRichText(),
    },
    meta: {
      title: 'За нас | Ibis Electronics',
      description:
        'Научи повече за Ibis Electronics: сервиз за битова техника и електроника с опит, оригинални части и фокус върху качествения ремонт.',
    },
    layout,
  } satisfies Partial<Page>

  const existing = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      slug: {
        equals: 'za-nas',
      },
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'pages',
      id: existing.docs[0].id,
      context: {
        disableRevalidate: true,
      },
      data: pageData,
      overrideAccess: true,
    })

    console.log(`Updated page: za-nas (${existing.docs[0].id})`)
    return
  }

  const created = await payload.create({
    collection: 'pages',
    context: {
      disableRevalidate: true,
    },
    data: pageData,
    overrideAccess: true,
  })

  console.log(`Created page: za-nas (${created.id})`)
}

void main()
