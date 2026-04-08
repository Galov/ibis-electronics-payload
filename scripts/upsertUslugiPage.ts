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
              text: 'Услуги',
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
              text: 'Оторизиран сервиз, диагностика, ремонт и резервни части за битова техника и електроника.',
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
      blockName: 'Оторизирани услуги',
      eyebrow: 'Основни направления',
      title: 'Оторизирани услуги',
      description: 'Работим по сервиз, поддръжка и резервни части.',
      items: [
        {
          title: 'Оторизиран сервиз на Arielli и Techmart',
          description: 'Приемаме гаранционни и извънгаранционни случаи за тези марки.',
          tags: [{ label: 'Arielli' }, { label: 'Techmart' }],
          highlights: [
            { text: 'Официален прием' },
            { text: 'Сервизни процедури по марка' },
            { text: 'Гаранционни и извънгаранционни случаи' },
          ],
        },
        {
          title: 'Delonghi и Kenwood с оригинални части',
          description: 'Сервиз и поддръжка с достъп до оригинални части и консумативи.',
          tags: [{ label: 'Delonghi' }, { label: 'Kenwood' }, { label: 'Оригинални части' }],
          highlights: [
            { text: 'Ремонт и поддръжка' },
            { text: 'Оригинални части' },
            { text: 'Консумативи при нужда' },
          ],
        },
        {
          title: 'Tesy и отоплителна техника',
          description: 'Сервиз и резервни части за отоплителни уреди и сходни категории.',
          tags: [{ label: 'Tesy' }, { label: 'Отопление' }],
          highlights: [
            { text: 'Често търсени части' },
            { text: 'Подходящо преди сезона' },
            { text: 'Периодична профилактика' },
          ],
        },
      ],
    },
    {
      blockType: 'serviceCards' as const,
      blockName: 'Ремонт и резервни части',
      eyebrow: 'Какво покриваме',
      title: 'Ремонт и резервни части',
      description: 'Съдействаме и при ремонт, и при търсене на правилната част.',
      items: [
        {
          title: 'Бяла техника и дребни електроуреди',
          description: 'Ремонт на широка гама електродомакински уреди.',
          highlights: [
            { text: 'Масова домашна техника' },
            { text: 'Преценка по конкретния случай' },
          ],
        },
        {
          title: 'Телевизори и електроника',
          description: 'Диагностика и ремонт на телевизори и електроника.',
          highlights: [
            { text: 'Работа по масови модели' },
            { text: 'Предварителна преценка' },
          ],
        },
        {
          title: 'Резервни части и аксесоари',
          description: 'Предлагаме части и аксесоари за електродомакинска техника.',
          highlights: [
            { text: 'Оригинални и съвместими части' },
            { text: 'Съдействие при избор' },
            { text: 'Подходящо и за самостоятелен ремонт' },
          ],
        },
      ],
    },
    {
      blockType: 'infoSteps' as const,
      blockName: 'Как работим',
      eyebrow: 'Процес',
      title: 'Как работим',
      description: 'Процесът е кратък и ясен.',
      items: [
        {
          title: 'Приемаме и уточняваме случая',
          summary: 'Първа преценка',
          description: 'Разглеждаме проблема, модела и симптомите.',
        },
        {
          title: 'Проверяваме части и рентабилност',
          summary: 'Техническа и ценова оценка',
          description: 'Проверяваме наличност на части и дали ремонтът е разумен като цена и срок.',
        },
        {
          title: 'Ремонтираме или насочваме към по-добра стъпка',
          summary: 'Финално решение',
          description: 'Ако ремонтът има смисъл, продължаваме. Ако не, казваме го директно.',
        },
      ],
    },
  ] satisfies NonNullable<Page['layout']>

  const pageData = {
    _status: 'published' as const,
    slug: 'uslugi',
    title: 'Услуги',
    hero: {
      type: 'lowImpact' as const,
      richText: createHeroRichText(),
    },
    meta: {
      title: 'Услуги | Ibis Electronics',
      description:
        'Услуги на Ibis Electronics: оторизиран сервиз, ремонт, диагностика и резервни части за битова техника, електроника и отоплителни уреди.',
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
        equals: 'uslugi',
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

    console.log(`Updated page: uslugi (${existing.docs[0].id})`)
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

  console.log(`Created page: uslugi (${created.id})`)
}

void main()
