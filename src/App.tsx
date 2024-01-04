import { useEffect, useState } from "react";
import Masonry from "react-masonry-css";
import JSZip from "jszip";
import "./App.css";

type imageArray = {
	url: string;
	dimensions: { width: number; height: number };
	extension: string;
}[];

function App() {
	const [images, setImages] = useState<imageArray>([]);
	const [selectedImages, setSelectedImages] = useState<string[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	const [siteName, setSiteName] = useState<string>("selected images");

	const fetchImages = async () => {
		const [tab] = await chrome.tabs.query({ active: true });

		chrome.scripting.executeScript(
			{
				target: { tabId: tab.id! },
				func: () => {
					const imageElements = document.querySelectorAll("img, svg");
					const imageInfo = Array.from(imageElements).map((element) => {
						let url, dimensions, extension;

						if (element instanceof HTMLImageElement) {
							url = element.src;
							dimensions = {
								width: element.naturalWidth,
								height: element.naturalHeight,
							};
							const fileNameMatch = url.match(
								// eslint-disable-next-line no-useless-escape
								/\/([^\/?]+(\.[a-z]+)(\?.+)?)$/i
							);
							extension = fileNameMatch ? fileNameMatch[2] : "unknown";
						} else if (element.tagName.toLowerCase() === "svg") {
							// Handle SVG elements
							url = element.outerHTML;
							const svgParser = new DOMParser();
							const svgDocument = svgParser.parseFromString(
								url,
								"image/svg+xml"
							);
							const svgElement = svgDocument.querySelector("svg");

							dimensions = {
								width: svgElement ? svgElement?.width?.baseVal?.value : 0,
								height: svgElement ? svgElement?.height?.baseVal?.value : 0,
							};
							extension = "svg";
						}

						return {
							url,
							dimensions,
							extension,
						};
					});

					return imageInfo;
				},
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result: any) => {
				const uniqueImages = Array.from(new Set(result[0].result));

				console.log(uniqueImages);
				setImages(uniqueImages as imageArray);
				setLoading(false);
			}
		);
	};

	const fetchSiteName = async () => {
		const [tab] = await chrome.tabs.query({ active: true });

		chrome.scripting.executeScript(
			{
				target: { tabId: tab.id! },
				func: () => {
					const hostName = window.location.hostname; // Get the current site's domain

					return hostName;
				},
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result: any) => {
				setSiteName(result[0].result);
			}
		);
	};

	useEffect(() => {
		fetchImages();
		fetchSiteName();
	}, []);

	const toggleImageSelection = (imageUrl: string) => {
		setSelectedImages((prevSelectedImages) => {
			if (prevSelectedImages.includes(imageUrl)) {
				// Image is already selected, remove it
				return prevSelectedImages.filter((img) => img !== imageUrl);
			} else {
				// Image is not selected, add it
				return [...prevSelectedImages, imageUrl];
			}
		});
	};

	const downloadSelectedImages = async () => {
		const zip = new JSZip();

		// Use Promise.all to wait for all images to be fetched and added to the ZIP
		await Promise.all(
			selectedImages.map(async (image, index) => {
				if (image.startsWith("<svg")) {
					// Handle SVG content differently
					const svgBlob = new Blob([image], { type: "image/svg+xml" });
					zip.file(`SVG_${index + 1}.svg`, svgBlob);
				} else {
					// Handle regular images
					const response = await fetch(image);
					const blob = await response.blob();

					// Extract the original image name from the URL based on known image extensions
					const fileNameMatch = image.match(
						// eslint-disable-next-line no-useless-escape
						/\/([^\/?]+(?:\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|avif)))/i
					);
					const originalImageName = fileNameMatch
						? fileNameMatch[1]
						: `Image_${index + 1}.jpg`;

					zip.file(originalImageName, blob);
				}
			})
		);

		// Generate the ZIP file after all images are added
		const content = await zip.generateAsync({ type: "blob" });

		// Create a download link and trigger the download
		const zipFileName = `${siteName} - image grabber.zip`;
		const link = document.createElement("a");
		link.href = URL.createObjectURL(content);
		link.download = zipFileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setSelectedImages([]);
	};

	const breakpointColumnsObj = {
		default: 3,
		1100: 3,
		700: 2,
	};

	return (
		<>
			{loading ? (
				<h2>Loading...</h2>
			) : (
				<>
					<Masonry
						breakpointCols={breakpointColumnsObj}
						className="image-grid"
						columnClassName="image-grid_column"
					>
						{images.map((image, indx) => (
							<div
								key={indx}
								className={`image-item ${
									selectedImages.includes(image.url) ? "selected" : ""
								}`}
							>
								<div className="tags d-flex">
									{!image.url.startsWith("<svg") && (
										<span className="tag">{`${image.dimensions.width} x ${image.dimensions.height}`}</span>
									)}
									<span className="tag">{image.extension}</span>
								</div>
								{image.url.startsWith("<svg") ? (
									<div
										dangerouslySetInnerHTML={{ __html: image.url }}
										onClick={() => toggleImageSelection(image.url)}
									/>
								) : (
									<img
										src={image.url}
										alt={`Image ${indx + 1}`}
										onClick={() => toggleImageSelection(image.url)}
									/>
								)}
								{selectedImages.includes(image.url) && (
									<div
										className="overlay"
										onClick={() => toggleImageSelection(image.url)}
									>
										<span>&#10003;</span>
									</div>
								)}
							</div>
						))}
					</Masonry>
					<div className="download-button-container">
						<button
							onClick={downloadSelectedImages}
							disabled={selectedImages.length === 0}
						>
							{selectedImages.length > 0
								? "Download Selected Images"
								: "Please select any image"}
						</button>
					</div>
				</>
			)}
		</>
	);
}

export default App;
