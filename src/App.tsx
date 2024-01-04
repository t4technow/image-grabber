import { useEffect, useState } from "react";
import Masonry from "react-masonry-css";
import JSZip from "jszip";
import "./App.css";

function App() {
	const [images, setImages] = useState<string[]>([]);
	const [selectedImages, setSelectedImages] = useState<string[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	const [siteName, setSiteName] = useState<string>("selected images");

	const fetchImages = async () => {
		const [tab] = await chrome.tabs.query({ active: true });

		chrome.scripting.executeScript(
			{
				target: { tabId: tab.id! },
				func: () => {
					const imageElements = document.querySelectorAll("img");
					const imageUrls = Array.from(imageElements).map((img) => img.src);
					// setSiteName(window.location.hostname); // Get the current site's domain

					return imageUrls;
				},
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(result: any) => {
				const uniqueImages = Array.from(new Set(result[0].result));
				setImages(uniqueImages as string[]);
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
		setLoading(false);
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
			selectedImages.map(async (imageUrl, index) => {
				const response = await fetch(imageUrl);
				const blob = await response.blob();

				// Extract the original image name from the URL based on known image extensions
				const fileNameMatch = imageUrl.match(
					// eslint-disable-next-line no-useless-escape
					/\/([^\/?]+(?:\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|avif)))/i
				);
				const originalImageName = fileNameMatch
					? fileNameMatch[1]
					: `Image ${index + 1}.jpg`;

				zip.file(originalImageName, blob);
			})
		);

		// Generate the ZIP file after all images are added
		const content = await zip.generateAsync({ type: "blob" });

		// Create a download link and trigger the download
		const zipFileName = `${siteName} - t4technow image grabber.zip`;
		const link = document.createElement("a");
		link.href = URL.createObjectURL(content);
		link.download = zipFileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const breakpointColumnsObj = {
		default: 3,
		1100: 3,
		700: 2,
	};

	return (
		<>
			{loading ? (
				<h2> loading... </h2>
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
									selectedImages.includes(image) ? "selected" : ""
								}`}
							>
								<img
									src={image}
									alt={`Image ${indx + 1}`}
									onClick={() => toggleImageSelection(image)}
								/>
								{selectedImages.includes(image) && (
									<div
										className="overlay"
										onClick={() => toggleImageSelection(image)}
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
