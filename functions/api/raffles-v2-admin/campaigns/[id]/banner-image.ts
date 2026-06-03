import { deleteRaffleImage, uploadRaffleImage } from './_image';

export const onRequestPost: PagesFunction = (context) => uploadRaffleImage('banner', context);
export const onRequestDelete: PagesFunction = (context) => deleteRaffleImage('banner', context);
